#version 460
#include "common.glsl"

// XR_FB_space_warp (docs/vr.md): the motion vector and depth images of one VR eye, at the runtime's recommended size (smaller than
// the eye's image). The motion vector is CurrNDC - PrevNDC of the surface point (the extension's definition), here from the scene
// depth and the eye's previous view-projection, so it holds the head's and the player's motion over static geometry; moving
// objects count as still. The depth is the scene's reverse-Z (1 at the near plane, 0 infinitely far), the nearest of the four
// texels under the pixel so that edges keep the foreground.
layout(push_constant) uniform PassPush {
    uvec4 ids;
    vec4 f0;
    vec4 f1;
    vec4 f2;
    mat4 m;
} pass;

layout(location = 0) in vec2 in_uv;
layout(location = 0) out vec4 out_motion;

void main() {
    View v = frame.views[pass.ids.w];
    vec2 uv = gl_FragCoord.xy * pass.f0.xy;
    ivec2 size = ivec2(v.viewport.xy);
    vec2 centre = uv * v.viewport.xy;
    ivec2 base = clamp(ivec2(centre - 0.5), ivec2(0), size - 2);
    float depth = 0.0;
    ivec2 texel = base;
    for (int i = 0; i < 4; ++i) {
        ivec2 t = base + ivec2(i & 1, i >> 1);
        float d = ImgFetch(IMG_DEPTH, t).x;
        if (d > depth) {
            depth = d;
            texel = t;
        }
    }
    vec2 ndc = (vec2(texel) + 0.5) * v.viewport.zw * 2.0 - 1.0;
    vec2 scaled = (ndc - v.jitter.xy) * v.projection_param.xy;
    vec3 current = vec3(ndc - pass.f0.zw, depth);  // f0.zw: the TAA jitter, so that the motion is the unjittered one
    vec4 previous;
    if (depth > 0.0) {
        float z = ViewZ(v, depth);
        vec3 world = (v.inv_view * vec4(scaled * z, z, 1.0)).xyz;
        previous = pass.m * vec4(world, 1.0);
    } else {
        // infinitely far: only the view's rotation moves it
        previous = pass.m * vec4(mat3(v.inv_view) * vec3(scaled, 1.0), 0.0);
        current.z = 0.0;
    }
    vec3 previous_ndc = previous.w > 1.0e-6 ? previous.xyz / previous.w : current;
    if (depth <= 0.0) previous_ndc.z = 0.0;
    out_motion = vec4(current - previous_ndc, 1.0);
    gl_FragDepth = depth;
}
