# The experimental VR mode (docs/vr.md): the Khronos OpenXR loader, loaded by the game at run time only when VR is on, and the
# headless test runtime that stands in for a headset in the tests. On Windows the loader and the headers come from the
# OpenXR.Loader package of the KhronosGroup/OpenXR-SDK-Source release (headers Apache-2.0 OR MIT, loader Apache-2.0); the
# package and the two license texts are pinned by their SHA-256 like the upscaler SDKs (cmake/Upscalers.cmake, pt_sdk_files).
# On Linux the package has no loader: the loader is built from the KhronosGroup/OpenXR-SDK release of the same version (with
# its vendored jsoncpp, so it needs nothing beyond glibc) and goes next to pt as libopenxr_loader.so.1, which xr_host.cpp
# opens through pt's RUNPATH $ORIGIN.
if(WIN32)
  set(pt_openxr_default ON)
else()
  set(pt_openxr_default OFF)
endif()
option(PT_OPENXR "Download the Khronos OpenXR loader and build the experimental VR mode" ${pt_openxr_default})

set(PT_OPENXR_VERSION "1.1.63")
set(PT_OPENXR_DIR "${PT_UPSCALER_SDK_DIR}/openxr-${PT_OPENXR_VERSION}")
set(PT_OPENXR_RUNTIME_FILES)
set(PT_OPENXR_NOTICES)
set(PT_OPENXR_INCLUDE "")
if(PT_OPENXR AND WIN32)
  pt_sdk_files(pt_openxr_package_ok "https://github.com/KhronosGroup/OpenXR-SDK-Source/releases/download/release-${PT_OPENXR_VERSION}"
    "${PT_OPENXR_DIR}" "OpenXR.Loader.${PT_OPENXR_VERSION}.nupkg|4e5a50a8807ef66f25180ff224e7d8150b594aa8ee4b07590f9ade55a8e98703")
  pt_sdk_files(pt_openxr_license_ok "https://raw.githubusercontent.com/KhronosGroup/OpenXR-SDK-Source/release-${PT_OPENXR_VERSION}"
    "${PT_OPENXR_DIR}" "LICENSE|cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30"
    "LICENSES/MIT.txt|8f25018489d6fe0dec34a352314c38dc146247b7de65735790f4398a92afa84b")
  set(PT_OPENXR_PACKAGE "${PT_OPENXR_DIR}/package")
  if(pt_openxr_package_ok AND NOT EXISTS "${PT_OPENXR_PACKAGE}/include/openxr/openxr.h")
    file(ARCHIVE_EXTRACT INPUT "${PT_OPENXR_DIR}/OpenXR.Loader.${PT_OPENXR_VERSION}.nupkg" DESTINATION "${PT_OPENXR_PACKAGE}")
  endif()
  if(pt_openxr_package_ok AND pt_openxr_license_ok AND EXISTS "${PT_OPENXR_PACKAGE}/native/x64/release/bin/openxr_loader.dll")
    set(PT_OPENXR_INCLUDE "${PT_OPENXR_PACKAGE}/include")
    list(APPEND PT_OPENXR_RUNTIME_FILES "${PT_OPENXR_PACKAGE}/native/x64/release/bin/openxr_loader.dll")
    list(APPEND PT_OPENXR_NOTICES "${PT_OPENXR_DIR}/LICENSE|Khronos_OpenXR_SDK_LICENSE.txt" "${PT_OPENXR_DIR}/LICENSES/MIT.txt|Khronos_OpenXR_SDK_MIT.txt")
  endif()
elseif(PT_OPENXR)
  FetchContent_Declare(openxr_sdk URL https://github.com/KhronosGroup/OpenXR-SDK/archive/refs/tags/release-${PT_OPENXR_VERSION}.tar.gz
    URL_HASH SHA256=5b8dac0608f49498fe8e95f562fe6bcf0bc781e561f137348a8c251d06a88b6f)
  FetchContent_Populate(openxr_sdk)
  # only the loader: the SDK's pre-generated sources need no Python, and the vendored jsoncpp keeps the system's out
  foreach(off BUILD_TESTS BUILD_API_LAYERS BUILD_CONFORMANCE_TESTS BUILD_SDK_TESTS BUILD_WITH_SYSTEM_JSONCPP BUILD_FORCE_GENERATION)
    set(${off} OFF CACHE BOOL "" FORCE)
  endforeach()
  set(DYNAMIC_LOADER ON CACHE BOOL "" FORCE)
  add_subdirectory(${openxr_sdk_SOURCE_DIR} ${openxr_sdk_BINARY_DIR} EXCLUDE_FROM_ALL)
  set(PT_OPENXR_INCLUDE "${openxr_sdk_SOURCE_DIR}/include")
  # the loader's own versioned file (SONAME libopenxr_loader.so.1) copied under its SONAME next to the game
  foreach(game pt pt_release)
    add_dependencies(${game} openxr_loader)
    add_custom_command(TARGET ${game} POST_BUILD COMMAND ${CMAKE_COMMAND} -E copy_if_different "$<TARGET_FILE:openxr_loader>"
      "$<TARGET_FILE_DIR:${game}>/libopenxr_loader.so.1" VERBATIM)
    set_target_properties(${game} PROPERTIES BUILD_RPATH "$ORIGIN" INSTALL_RPATH "$ORIGIN")
  endforeach()
  list(APPEND PT_OPENXR_NOTICES "${openxr_sdk_SOURCE_DIR}/LICENSE|Khronos_OpenXR_SDK_LICENSE.txt"
    "${openxr_sdk_SOURCE_DIR}/LICENSES/MIT.txt|Khronos_OpenXR_SDK_MIT.txt"
    "${openxr_sdk_SOURCE_DIR}/LICENSES/LicenseRef-jsoncpp-public-domain.txt|jsoncpp_LICENSE.txt")
endif()

if(PT_OPENXR_INCLUDE)
  target_include_directories(pt_engine PRIVATE "${PT_OPENXR_INCLUDE}")
  target_compile_definitions(pt_engine PRIVATE PT_WITH_OPENXR=1)

  # the headless test runtime (tools/xr_test_runtime): its own folder, so tools/package.py (which ships the DLLs next to the
  # executable) never takes it; tests select it with XR_RUNTIME_JSON=<build>/xr_test_runtime/pt_xr_test_runtime.json
  add_library(pt_xr_test_runtime SHARED tools/xr_test_runtime/xr_test_runtime.cpp)
  target_include_directories(pt_xr_test_runtime PRIVATE "${PT_OPENXR_INCLUDE}" "${stb_SOURCE_DIR}")
  target_link_libraries(pt_xr_test_runtime PRIVATE Vulkan::Headers)
  # no lib prefix on Linux either: the manifest names the same file on both
  set_target_properties(pt_xr_test_runtime PROPERTIES OUTPUT_NAME "pt_xr_test_runtime" PREFIX ""
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/xr_test_runtime" LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/xr_test_runtime")
  if(MSVC)
    target_compile_options(pt_xr_test_runtime PRIVATE /W3 /utf-8 /EHsc)
  endif()
  # a library path with a separator is relative to the manifest (a bare name would be looked for on the system's path)
  file(WRITE "${CMAKE_BINARY_DIR}/xr_test_runtime/pt_xr_test_runtime.json"
    "{\n  \"file_format_version\": \"1.0.0\",\n  \"runtime\": {\n    \"name\": \"pt-port headless test runtime\",\n    \"library_path\": \"./pt_xr_test_runtime${CMAKE_SHARED_LIBRARY_SUFFIX}\"\n  }\n}\n")
  add_dependencies(pt pt_xr_test_runtime)
elseif(PT_OPENXR)
  message(WARNING "OpenXR loader not available: the VR mode is left out of this build")
endif()
