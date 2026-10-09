#pragma once
#include <cstdint>
#include <string>
#include <vector>

namespace pt::localized {

struct SubtitleTranslation {
    uint32_t key = 0;
    std::vector<std::string> lines;
};

// The translated subtitles of the added languages (7 Turkish to 12 Czech) from subtitles/<code>.txt next to the
// executable (tools/subtitle_pack.py writes them); empty when the pack is missing, and the subtitles stay English.
const std::vector<SubtitleTranslation>& SubtitleTranslations(int language);

}
