#pragma once

#include <glm/glm.hpp>
#include <glm/gtc/quaternion.hpp>

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

#include "engine/render/vk_context.h"

namespace pt::xr {

struct ViewPose {
    glm::quat orientation{1.0f, 0.0f, 0.0f, 0.0f};
    glm::vec3 position{0.0f};
    glm::vec4 tangents{-1.0f, 1.0f, 1.0f, -1.0f};
    glm::vec4 angles{0.0f};
};

struct HandPose {
    bool valid = false;
    glm::quat orientation{1.0f, 0.0f, 0.0f, 0.0f};
    glm::vec3 position{0.0f};
};

struct ControllerState {
    bool active = false;
    glm::vec2 move{0.0f};
    glm::vec2 turn{0.0f};
    bool interact = false;
    bool back = false;
    bool menu = false;
    bool zoom = false;
    bool gouge = false;
    bool triangle = false;
    bool settings = false;
    HandPose aim[2];
};

struct Swapchain {
    uint64_t handle = 0;
    VkFormat format = VK_FORMAT_UNDEFINED;
    VkExtent2D extent{};
    std::vector<VkImage> images;
    std::vector<VkImageView> views;
    uint32_t index = 0;
    bool acquired = false;
};

struct FrameLayers {
    bool projection = false;
    ViewPose eyes[2];
    bool hud = false;
    glm::quat hud_orientation{1.0f, 0.0f, 0.0f, 0.0f};
    glm::vec3 hud_position{0.0f};
    glm::vec2 hud_size{1.6f, 0.9f};
    bool screen = false;
    glm::quat screen_orientation{1.0f, 0.0f, 0.0f, 0.0f};
    glm::vec3 screen_position{0.0f};
    glm::vec2 screen_size{3.2f, 1.8f};
    /* XR_FB_space_warp (docs/vr.md): the eyes' motion vector and depth images (MotionSwapchain, DepthSwapchain) go with the
       projection layer; app_delta is the change of the game's mapping of the tracking space into the world since the last
       frame (the player walking or turning), skip asks the runtime not to extrapolate this frame (a cut or a warp) */
    bool space_warp = false;
    bool space_warp_skip = false;
    glm::quat app_delta_orientation{1.0f, 0.0f, 0.0f, 0.0f};
    glm::vec3 app_delta_position{0.0f};
    float near_plane = 0.05f;
};

class Host final : public vk::ContextCreator {
public:
    Host();
    ~Host() override;
    Host(const Host&) = delete;
    Host& operator=(const Host&) = delete;

    bool Init(const std::string& application);
    bool Ready() const;
    const std::string& Error() const { return error_; }
    const std::string& RuntimeName() const { return runtime_name_; }

    VkResult CreateInstance(const VkInstanceCreateInfo& info, VkInstance& instance) override;
    VkPhysicalDevice PhysicalDevice(VkInstance instance) override;
    VkResult CreateDevice(VkPhysicalDevice physical, const VkDeviceCreateInfo& info, VkDevice& device) override;

    bool StartSession(vk::Context& ctx, float scale, bool space_warp = false);
    void Shutdown();

    void PollEvents();
    bool SessionRunning() const;
    bool ExitRequested() const;
    bool Focused() const;
    bool FocusLost() const;
    bool WaitFrame();
    bool ShouldRender() const;
    bool BeginFrame();
    void LocateViews();
    void SyncActions();
    void EndFrame(const FrameLayers& layers);
    bool FrameOpen() const { return frame_open_; }
    int64_t DisplayTime() const { return display_time_; }
    double DisplayPeriod() const { return display_period_; }

    const ViewPose& Eye(int i) const { return eyes_[i]; }
    const ViewPose& Head() const { return head_; }
    bool ViewsValid() const { return views_valid_; }
    const ControllerState& Controllers() const { return controllers_; }
    void Haptic(int hand, float amplitude, float seconds);

    Swapchain& EyeSwapchain(int i) { return eye_swapchains_[i]; }
    Swapchain& HudSwapchain() { return hud_swapchain_; }
    Swapchain& ScreenSwapchain() { return screen_swapchain_; }
    bool Acquire(Swapchain& swapchain);
    void Release(Swapchain& swapchain);
    VkExtent2D EyeExtent() const { return eye_swapchains_[0].extent; }
    /* space warp: on when the runtime has XR_FB_space_warp and its swapchains were made (StartSession) */
    bool SpaceWarp() const { return space_warp_; }
    Swapchain& MotionSwapchain(int i) { return motion_swapchains_[i]; }
    Swapchain& DepthSwapchain(int i) { return depth_swapchains_[i]; }

    uint64_t FramesSubmitted() const { return frames_submitted_; }

    struct Impl;

private:
    std::unique_ptr<Impl> impl_;
    std::string error_;
    std::string runtime_name_;
    ViewPose eyes_[2];
    ViewPose head_;
    bool views_valid_ = false;
    ControllerState controllers_;
    Swapchain eye_swapchains_[2];
    Swapchain hud_swapchain_;
    Swapchain screen_swapchain_;
    bool space_warp_supported_ = false;
    bool space_warp_ = false;
    VkExtent2D motion_extent_{};
    Swapchain motion_swapchains_[2];
    Swapchain depth_swapchains_[2];
    int64_t display_time_ = 0;
    double display_period_ = 1.0 / 90.0;
    bool frame_open_ = false;
    bool should_render_ = false;
    uint64_t frames_submitted_ = 0;
};

bool Available();

}
