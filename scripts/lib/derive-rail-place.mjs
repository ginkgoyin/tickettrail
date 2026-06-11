function normalizeText(value) {
  return `${value ?? ""}`.trim();
}

function normalizePlaceSegment(value) {
  return normalizeText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCaseAscii(value) {
  const trimmed = normalizeText(value).toLowerCase();
  if (!trimmed) {
    return "";
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

const CURATED_EXACT_PLACE_RULES = [
  {
    nameZh: "\u4e0a\u6d77\u8679\u6865",
    pinyin: "shanghaihongqiao",
    placeNameZh: "\u4e0a\u6d77",
    placeNameEn: "Shanghai",
    placeRule: "curated:shanghai-hongqiao",
  },
  {
    nameZh: "\u9999\u6e2f\u897f\u4e5d\u9f99",
    pinyin: "xianggangxijiulong",
    placeNameZh: "\u9999\u6e2f",
    placeNameEn: "Xianggang",
    placeRule: "curated:hong-kong-west-kowloon",
  },
];

const DIRECTIONAL_SUFFIX_ZH = ["\u5317", "\u5357", "\u4e1c", "\u897f"];
const DIRECTIONAL_SUFFIX_PINYIN = ["bei", "nan", "dong", "xi"];

function stripDirectionalSuffixZh(nameZh) {
  const normalizedName = normalizeText(nameZh);
  if (normalizedName.length <= 2) {
    return null;
  }

  const lastCharacter = normalizedName.slice(-1);
  if (!DIRECTIONAL_SUFFIX_ZH.includes(lastCharacter)) {
    return null;
  }

  return normalizedName.slice(0, -1);
}

function stripDirectionalSuffixPinyin(pinyin) {
  const normalizedPinyin = normalizeText(pinyin).toLowerCase();
  for (const suffix of DIRECTIONAL_SUFFIX_PINYIN) {
    if (normalizedPinyin.endsWith(suffix) && normalizedPinyin.length > suffix.length) {
      return normalizedPinyin.slice(0, -suffix.length);
    }
  }

  return null;
}

function buildPlaceKey(placePinyin) {
  const normalizedPlace = normalizePlaceSegment(placePinyin);
  return normalizedPlace ? `cn-${normalizedPlace}` : "cn";
}

export function deriveRailPlaceMetadata({ nameZh, pinyin, nameEn }) {
  const normalizedNameZh = normalizeText(nameZh);
  const normalizedPinyin = normalizeText(pinyin || nameEn).toLowerCase();

  const curatedRule = CURATED_EXACT_PLACE_RULES.find(
    (rule) => rule.nameZh === normalizedNameZh || rule.pinyin === normalizedPinyin,
  );
  if (curatedRule) {
    return {
      placeNameZh: curatedRule.placeNameZh,
      placeNameEn: curatedRule.placeNameEn,
      placeKey: buildPlaceKey(curatedRule.placeNameEn),
      placeConfidence: "high",
      placeRule: curatedRule.placeRule,
    };
  }

  const strippedZh = stripDirectionalSuffixZh(normalizedNameZh);
  const strippedPinyin = stripDirectionalSuffixPinyin(normalizedPinyin);
  if (strippedZh && strippedPinyin) {
    return {
      placeNameZh: strippedZh,
      placeNameEn: titleCaseAscii(strippedPinyin),
      placeKey: buildPlaceKey(strippedPinyin),
      placeConfidence: "medium",
      placeRule: "derived:strip-directional-suffix",
    };
  }

  return {
    placeNameZh: normalizedNameZh,
    placeNameEn: titleCaseAscii(normalizedPinyin),
    placeKey: buildPlaceKey(normalizedPinyin),
    placeConfidence: "low",
    placeRule: "fallback:original-station-name",
  };
}
