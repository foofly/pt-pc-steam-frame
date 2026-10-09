#version 460
#include "common.glsl"

// Temporal anti-aliasing of a VR eye (docs/vr.md, [vr] antialiasing): the eye is drawn with a sub-pixel jitter a frame, and its
// tonemapped image is blended into the eye's own history, reprojected through the scene depth and the eye's previous unjittered
// view-projection (static geometry exactly; moving objects are held by the neighbourhood clamp). Replaces FXAA in VR.
// ids: x the current LDR image, y the eye's history, z 1 when the history is valid, w the view
// f0: xy this frame's jitter in NDC, z the weight of the current frame
// m: the eye's previous unjittered view-projection
layout(push_constant) uniform PassPush {
    uvec4 ids;
    vec4 f0;
    vec4 f1;
    vec4 f2;
    mat4 m;
} pass;

layout(location = 0) in vec2 in_uv;
layout(location = 0) out vec4 out_color;

vec3 ToYCoCg(vec3 c) { return vec3(dot(c, vec3(0.25, 0.5, 0.25)), dot(c, vec3(0.5, 0.0, -0.5)), dot(c, vec3(-0.25, 0.5, -0.25))); }
vec3 FromYCoCg(vec3 c) { return vec3(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z); }

// the history with a 5-tap Catmull-Rom filter (bilinear taps), so that it does not soften frame after frame
vec3 SampleHistory(uint index, vec2 uv, vec2 size) {
    vec2 position = uv * size;
    vec2 centre = floor(position - 0.5) + 0.5;
    vec2 f = position - centre;
    vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
    vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
    vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
    vec2 w3 = f * f * (-0.5 + 0.5 * f);
    vec2 w12 = w1 + w2;
    vec2 t0 = (centre - 1.0) / size;
    vec2 t3 = (centre + 2.0) / size;
    vec2 t12 = (centre + w2 / w12) / size;
    vec3 c = Img(index, SMP_LINEAR_CLAMP, vec2(t12.x, t0.y)).rgb * (w12.x * w0.y) +
             Img(index, SMP_LINEAR_CLAMP, vec2(t0.x, t12.y)).rgb * (w0.x * w12.y) +
             Img(index, SMP_LINEAR_CLAMP, vec2(t12.x, t12.y)).rgb * (w12.x * w12.y) +
             Img(index, SMP_LINEAR_CLAMP, vec2(t3.x, t12.y)).rgb * (w3.x * w12.y) +
             Img(index, SMP_LINEAR_CLAMP, vec2(t12.x, t3.y)).rgb * (w12.x * w3.y);
    float weight = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
    return max(c / weight, vec3(0.0));
}

void main() {
    View v = frame.views[pass.ids.w];
    ivec2 pixel = ivec2(gl_FragCoord.xy);
    ivec2 size = ivec2(v.viewport.xy);
    vec3 current = ImgFetch(pass.ids.x, pixel).rgb;
    if (pass.ids.z == 0u) {
        out_color = vec4(current, 1.0);
        return;
    }
    // the neighbourhood's colour box (variance clipping) and its nearest depth
    vec3 m1 = vec3(0.0);
    vec3 m2 = vec3(0.0);
    float closest = 0.0;
    ivec2 closest_pixel = pixel;
    for (int y = -1; y <= 1; ++y) {
        for (int x = -1; x <= 1; ++x) {
            ivec2 q = clamp(pixel + ivec2(x, y), ivec2(0), size - 1);
            vec3 c = ToYCoCg(ImgFetch(pass.ids.x, q).rgb);
            m1 += c;
            m2 += c * c;
            float d = ImgFetch(IMG_DEPTH, q).x;
            if (d > closest) {
                closest = d;
                closest_pixel = q;
            }
        }
    }
    m1 /= 9.0;
    vec3 sigma = sqrt(max(m2 / 9.0 - m1 * m1, vec3(0.0)));
    vec3 box_min = m1 - 1.25 * sigma;
    vec3 box_max = m1 + 1.25 * sigma;

    // the motion of the nearest surface: its unjittered position now against the previous frame's
    vec2 ndc = (vec2(closest_pixel) + 0.5) * v.viewport.zw * 2.0 - 1.0;
    vec2 scaled = (ndc - v.jitter.xy) * v.projection_param.xy;
    vec4 previous;
    if (closest > 0.0) {
        float z = ViewZ(v, closest);
        previous = pass.m * vec4((v.inv_view * vec4(scaled * z, z, 1.0)).xyz, 1.0);
    } else {
        previous = pass.m * vec4(mat3(v.inv_view) * vec3(scaled, 1.0), 0.0);
    }
    if (previous.w <= 1.0e-6) {
        out_color = vec4(current, 1.0);
        return;
    }
    vec2 motion = (ndc - pass.f0.xy) - previous.xy / previous.w;
    vec2 here = (vec2(pixel) + 0.5) * v.viewport.zw * 2.0 - 1.0 - pass.f0.xy;
    vec2 history_uv = (here - motion) * 0.5 + 0.5;
    if (any(lessThan(history_uv, vec2(0.0))) || any(greaterThan(history_uv, vec2(1.0)))) {
        out_color = vec4(current, 1.0);
        return;
    }
    vec3 history = ToYCoCg(SampleHistory(pass.ids.y, history_uv, v.viewport.xy));
    history = FromYCoCg(clamp(history, box_min, box_max));
    out_color = vec4(mix(history, current, pass.f0.z), 1.0);
}
