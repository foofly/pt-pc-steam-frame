#include "engine/core/subtitle_translations.h"

#include <array>
#include <fstream>
#include <mutex>
#include <optional>

#include "engine/core/log.h"
#include "engine/core/resource_path.h"

namespace pt::localized {
namespace {

constexpr int kFirst = 7;
constexpr const char* kCodes[] = {"Tur", "Zhs", "Ara", "Rus", "Ukr"};

std::vector<SubtitleTranslation> LoadPack(const char* code) {
    std::vector<SubtitleTranslation> out;
    const std::filesystem::path path = ExecutableDir() / "subtitles" / (std::string(code) + ".txt");
    std::ifstream in(path, std::ios::binary);
    if (!in) {
        LogWarn("subtitles: no {} translation pack at {} (tools/subtitle_pack.py), English subtitles", code, path.string());
        return out;
    }
    std::string line;
    while (std::getline(in, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line.size() < 10 || line[8] != '\t') continue;
        const uint32_t key = static_cast<uint32_t>(std::stoul(line.substr(0, 8), nullptr, 16));
        if (out.empty() || out.back().key != key) out.push_back({key, {}});
        out.back().lines.push_back(line.substr(9));
    }
    LogInfo("subtitles: {} translations from {}", out.size(), path.string());
    return out;
}

}

const std::vector<SubtitleTranslation>& SubtitleTranslations(int language) {
    static const std::vector<SubtitleTranslation> none;
    static std::mutex mutex;
    static std::array<std::optional<std::vector<SubtitleTranslation>>, std::size(kCodes)> packs;
    const int index = language - kFirst;
    if (index < 0 || index >= static_cast<int>(std::size(kCodes))) return none;
    std::lock_guard lock(mutex);
    if (!packs[index]) packs[index] = LoadPack(kCodes[index]);
    return *packs[index];
}

}
