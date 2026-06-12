import type { LocationDirectoryEntry } from "../types/ticket";

type AirportAliasOverlayEntry = Partial<Pick<LocationDirectoryEntry, "nameZh" | "timezone">> & {
  aliases: string[];
};

const airportAliasesZhCN: Record<string, AirportAliasOverlayEntry> = {
  CAN: {
    nameZh: "广州白云国际机场",
    timezone: "Asia/Shanghai",
    aliases: ["广州白云", "白云机场", "广州白云国际机场"],
  },
  CKG: {
    nameZh: "重庆江北国际机场",
    timezone: "Asia/Shanghai",
    aliases: ["重庆江北", "江北机场", "重庆江北国际机场"],
  },
  CSX: {
    nameZh: "长沙黄花国际机场",
    timezone: "Asia/Shanghai",
    aliases: ["长沙", "长沙黄花", "黄花机场", "长沙黄花国际机场"],
  },
  CTU: {
    nameZh: "成都双流国际机场",
    timezone: "Asia/Shanghai",
    aliases: ["成都双流", "双流机场", "成都双流国际机场"],
  },
  HGH: {
    nameZh: "杭州萧山国际机场",
    timezone: "Asia/Shanghai",
    aliases: ["杭州萧山", "萧山机场", "杭州萧山国际机场"],
  },
  KMG: {
    nameZh: "昆明长水国际机场",
    timezone: "Asia/Shanghai",
    aliases: ["昆明长水", "长水机场", "昆明长水国际机场"],
  },
  NKG: {
    nameZh: "南京禄口国际机场",
    timezone: "Asia/Shanghai",
    aliases: ["南京禄口", "禄口机场", "南京禄口国际机场"],
  },
  TAO: {
    nameZh: "青岛胶东国际机场",
    timezone: "Asia/Shanghai",
    aliases: ["青岛", "青岛胶东", "胶东机场", "青岛胶东国际机场"],
  },
  PEK: {
    nameZh: "北京首都国际机场",
    timezone: "Asia/Shanghai",
    aliases: ["北京首都", "首都机场", "北京首都国际机场"],
  },
  PKX: {
    nameZh: "北京大兴国际机场",
    timezone: "Asia/Shanghai",
    aliases: ["北京大兴", "大兴机场", "北京大兴国际机场"],
  },
  PVG: {
    nameZh: "上海浦东国际机场",
    timezone: "Asia/Shanghai",
    aliases: ["上海浦东", "浦东机场", "上海浦东国际机场"],
  },
  SHA: {
    nameZh: "上海虹桥国际机场",
    timezone: "Asia/Shanghai",
    aliases: ["上海虹桥", "虹桥机场", "上海虹桥国际机场"],
  },
  SZX: {
    nameZh: "深圳宝安国际机场",
    timezone: "Asia/Shanghai",
    aliases: ["深圳宝安", "宝安机场", "深圳宝安国际机场"],
  },
  TFU: {
    nameZh: "成都天府国际机场",
    timezone: "Asia/Shanghai",
    aliases: ["成都天府", "天府机场", "成都天府国际机场"],
  },
  TSN: {
    nameZh: "天津滨海国际机场",
    timezone: "Asia/Shanghai",
    aliases: ["天津滨海", "滨海机场", "天津滨海国际机场"],
  },
  XIY: {
    nameZh: "西安咸阳国际机场",
    timezone: "Asia/Shanghai",
    aliases: ["西安咸阳", "咸阳机场", "西安咸阳国际机场"],
  },
  XMN: {
    nameZh: "厦门高崎国际机场",
    timezone: "Asia/Shanghai",
    aliases: ["厦门", "厦门高崎", "高崎机场", "厦门高崎国际机场"],
  },
};

export default airportAliasesZhCN;
