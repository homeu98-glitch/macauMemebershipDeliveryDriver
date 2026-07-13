import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../lib/auth";
import { createOrSyncOrder, type CreateOrderInput } from "../../../../lib/siteb-order-api";


type ManualCreateOrderBody = {
  mode?: "manual";
  externalOrderId?: string;
  deliveryFeeMop?: number;
  urgent?: boolean;
  paymentBy?: "customer" | "shop";
  deliveryDeadline?: string;
  shop: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    contactName?: string;
    contactPhone?: string;
  };
  customer: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    phone?: string;
    deliveryNote?: string;
  };
};

const shopSamples = [
  {
    name: "議事亭前地",
    address: "議事亭前地 Largo do Senado",
    latitude: 22.1938271,
    longitude: 113.5399903,
    contactName: "店員",
    contactPhone: "+85328991001"
  },
  {
    name: "大三巴牌坊",
    address: "大三巴牌坊 Ruínas de São Paulo",
    latitude: 22.197457,
    longitude: 113.5408602,
    contactName: "店員",
    contactPhone: "+85328991002"
  },
  {
    name: "媽閣廟",
    address: "媽閣廟 Templo de A-Ma",
    latitude: 22.1861086,
    longitude: 113.5312671,
    contactName: "前台",
    contactPhone: "+85328991003"
  },
  {
    name: "東望洋炮台",
    address: "東望洋炮台 Fortaleza da Guia",
    latitude: 22.1965398,
    longitude: 113.5496929,
    contactName: "店員",
    contactPhone: "+85328991004"
  },
  {
    name: "澳門旅遊塔",
    address: "澳門旅遊塔 Macau Tower",
    latitude: 22.1798001,
    longitude: 113.5367959,
    contactName: "店員",
    contactPhone: "+85328991005"
  },
  {
    name: "關閘",
    address: "關閘 Portas do Cerco",
    latitude: 22.2159386,
    longitude: 113.5492052,
    contactName: "前台",
    contactPhone: "+85328991006"
  },
  {
    name: "澳門漁人碼頭",
    address: "澳門漁人碼頭 Doca dos Pescadores de Macau",
    latitude: 22.1927549,
    longitude: 113.55603,
    contactName: "店員",
    contactPhone: "+85328991007"
  },
  {
    name: "澳門科學館",
    address: "澳門科學館 Centro de Ciência de Macau",
    latitude: 22.1863938,
    longitude: 113.5564848,
    contactName: "店員",
    contactPhone: "+85328991008"
  },
  {
    name: "澳門文化中心",
    address: "澳門文化中心 Centro Cultural de Macau",
    latitude: 22.1889495,
    longitude: 113.5553742,
    contactName: "前台",
    contactPhone: "+85328991009"
  },
  {
    name: "澳門博物館",
    address: "澳門博物館 Museu de Macau",
    latitude: 22.1971533,
    longitude: 113.5421536,
    contactName: "店員",
    contactPhone: "+85328991010"
  },
  {
    name: "新葡京酒店",
    address: "新葡京酒店 Hotel Grand Lisboa",
    latitude: 22.1909967,
    longitude: 113.5433705,
    contactName: "店員",
    contactPhone: "+85328991011"
  },
  {
    name: "葡京酒店",
    address: "葡京酒店 Hotel Lisboa",
    latitude: 22.1897931,
    longitude: 113.5444545,
    contactName: "前台",
    contactPhone: "+85328991012"
  },
  {
    name: "永利澳門",
    address: "永利澳門 Wynn Macau",
    latitude: 22.1881088,
    longitude: 113.5466049,
    contactName: "店員",
    contactPhone: "+85328991013"
  },
  {
    name: "澳門美高梅",
    address: "澳門美高梅 MGM Macau",
    latitude: 22.1857992,
    longitude: 113.5480486,
    contactName: "店員",
    contactPhone: "+85328991014"
  },
  {
    name: "澳門金沙酒店",
    address: "澳門金沙酒店 Sands Macao Hotel",
    latitude: 22.1907408,
    longitude: 113.5553195,
    contactName: "前台",
    contactPhone: "+85328991015"
  },
  {
    name: "塔石廣場",
    address: "塔石廣場 Praça do Tap Siac",
    latitude: 22.1981161,
    longitude: 113.547134,
    contactName: "店員",
    contactPhone: "+85328991016"
  },
  {
    name: "南灣湖",
    address: "南灣湖 Lago Nam Van",
    latitude: 22.1863375,
    longitude: 113.5420811,
    contactName: "店員",
    contactPhone: "+85328991017"
  },
  {
    name: "港務局大樓",
    address: "港務局大樓 Quartel dos Mouros",
    latitude: 22.1873744,
    longitude: 113.5326319,
    contactName: "前台",
    contactPhone: "+85328991018"
  },
  {
    name: "外港客運碼頭",
    address: "外港客運碼頭 Terminal Marítimo do Porto Exterior",
    latitude: 22.1970479,
    longitude: 113.5592096,
    contactName: "店員",
    contactPhone: "+85328991019"
  },
  {
    name: "玫瑰聖母堂",
    address: "玫瑰聖母堂",
    latitude: 22.1948416,
    longitude: 113.5403642,
    contactName: "店員",
    contactPhone: "+85328991020"
  }
];

const customerSamples = [
  {
    name: "大炮台",
    phone: "+85366112001",
    address: "大炮台 Fortaleza do Monte",
    latitude: 22.1970679,
    longitude: 113.5422432,
    deliveryNote: "到達後請致電。"
  },
  {
    name: "龍環葡韻",
    phone: "+85366112002",
    address: "龍環葡韻住宅式博物館",
    latitude: 22.1539406,
    longitude: 113.5597339,
    deliveryNote: "到樓下先致電。"
  },
  {
    name: "氹仔舊城區",
    phone: "+85366112003",
    address: "氹仔舊城區 Vila de Taipa",
    latitude: 22.1534933,
    longitude: 113.5566151,
    deliveryNote: "請在附近停車位等候。"
  },
  {
    name: "官也街",
    phone: "+85366112004",
    address: "官也街 Rua do Cunha",
    latitude: 22.1535855,
    longitude: 113.5569741,
    deliveryNote: "人多請先聯絡。"
  },
  {
    name: "新濠天地",
    phone: "+85366112005",
    address: "新濠天地 City of Dreams",
    latitude: 22.1491792,
    longitude: 113.5664134,
    deliveryNote: "到達後請聯絡客戶。"
  },
  {
    name: "澳門銀河",
    phone: "+85366112006",
    address: "澳門銀河 Galaxy Macau",
    latitude: 22.1474457,
    longitude: 113.5545693,
    deliveryNote: "放管理處。"
  },
  {
    name: "威尼斯人",
    phone: "+85366112007",
    address: "澳門威尼斯人酒店 The Venetian Macao",
    latitude: 22.1481996,
    longitude: 113.560472,
    deliveryNote: "請到酒店門口。"
  },
  {
    name: "巴黎人",
    phone: "+85366112008",
    address: "澳門巴黎人 The Parisian Macau",
    latitude: 22.1436317,
    longitude: 113.5616812,
    deliveryNote: "請到正門。"
  },
  {
    name: "新濠影滙",
    phone: "+85366112009",
    address: "新濠影滙 Studio City Macao",
    latitude: 22.1412465,
    longitude: 113.5605386,
    deliveryNote: "請到正門。"
  },
  {
    name: "澳門倫敦人",
    phone: "+85366112010",
    address: "澳門倫敦人 The Londoner Macao",
    latitude: 22.1458115,
    longitude: 113.5653355,
    deliveryNote: "請到正門。"
  },
  {
    name: "永利皇宮",
    phone: "+85366112011",
    address: "永利皇宮 Wynn Palace",
    latitude: 22.1480986,
    longitude: 113.571403,
    deliveryNote: "請到正門。"
  },
  {
    name: "澳門國際機場",
    phone: "+85366112012",
    address: "澳門國際機場",
    latitude: 22.149929,
    longitude: 113.5893607,
    deliveryNote: "到達後請致電。"
  },
  {
    name: "澳門大學",
    phone: "+85366112013",
    address: "澳門大學 Universidade de Macau",
    latitude: 22.1284604,
    longitude: 113.5438378,
    deliveryNote: "到達後請致電。"
  },
  {
    name: "氹仔客運碼頭",
    phone: "+85366112014",
    address: "氹仔客運碼頭 Terminal Marítimo da Taipa",
    latitude: 22.1627825,
    longitude: 113.5758222,
    deliveryNote: "到達後請致電。"
  },
  {
    name: "黑沙環海濱花園",
    phone: "+85366112015",
    address: "黑沙環海濱花園 2 座",
    latitude: 22.207269173860297,
    longitude: 113.55519339747916,
    deliveryNote: "放管理處。"
  },
  {
    name: "黑沙海灘",
    phone: "+85366112016",
    address: "黑沙海灘 Praia de Hác Sá",
    latitude: 22.1212703,
    longitude: 113.5709904,
    deliveryNote: "到達後請致電。"
  },
  {
    name: "竹灣海灘",
    phone: "+85366112017",
    address: "竹灣海灘 Baia de Cheoc Van",
    latitude: 22.1129446,
    longitude: 113.5592411,
    deliveryNote: "到達後請致電。"
  },
  {
    name: "石排灣郊野公園",
    phone: "+85366112018",
    address: "石排灣郊野公園 Parque de Seac Pai Van",
    latitude: 22.1267853,
    longitude: 113.5588425,
    deliveryNote: "到達後請致電。"
  },
  {
    name: "路環村",
    phone: "+85366112019",
    address: "路環村 Vila de Coloane",
    latitude: 22.1163641,
    longitude: 113.5513368,
    deliveryNote: "到達後請致電。"
  },
  {
    name: "路環聖方濟各聖堂",
    phone: "+85366112020",
    address: "路環聖方濟各聖堂",
    latitude: 22.1169176,
    longitude: 113.5514616,
    deliveryNote: "到達後請致電。"
  }
];

const itemSets = [
  [
    { name: "乾炒牛河", quantity: 1 },
    { name: "凍檸茶", quantity: 1 }
  ],
  [
    { name: "豬扒包", quantity: 2 },
    { name: "薯條", quantity: 1 }
  ],
  [
    { name: "魚蛋粉", quantity: 1 },
    { name: "熱奶茶", quantity: 2 }
  ]
];

function sample<T>(items: T[], index: number) {
  return items[index % items.length];
}

function buildRandomOrder(index: number, callbackBaseUrl: string): CreateOrderInput {
  const now = new Date();
  const deliveryDeadline = new Date(now.getTime() + (25 + index * 7) * 60 * 1000).toISOString();
  const shop = sample(shopSamples, Date.now() + index);
  const customer = sample(customerSamples, Date.now() + index * 3);
  const items = sample(itemSets, Date.now() + index * 5);
  const suffix = `${Date.now()}-${index + 1}`;

  return {
    externalOrderId: `TEST-${suffix}`,
    pickupMode: "now",
    deliveryMode: "scheduled",
    deliveryDeadline,
    deliveryFeeMop: 28 + index * 6,
    urgent: false,
    currency: "MOP",
    shop: {
      externalShopId: `TEST-SHOP-${index + 1}-${suffix}`,
      ...shop
    },
    customer: {
      externalCustomerId: `TEST-CUSTOMER-${index + 1}-${suffix}`,
      ...customer
    },
    items,
    notes: {
      shopNote: "此訂單由後台測試頁建立。",
      driverNote: "請優先檢查資料流與通知。",
      paymentBy: Math.random() < 0.5 ? "customer" : "shop"
    },
    callback: {
      url: `${callbackBaseUrl}/api/integration/delivery/siteb/callback`,
      headers: {
        "X-SiteA-Key": "sitea-demo-key"
      }
    }
  };
}


function buildManualOrder(input: ManualCreateOrderBody, callbackBaseUrl: string): CreateOrderInput {
  const suffix = Date.now();
  const externalOrderId = input.externalOrderId?.trim() || `MANUAL-${suffix}`;
  const deadline = input.deliveryDeadline?.trim() || new Date(Date.now() + 30 * 60 * 1000).toISOString();

  return {
    externalOrderId,
    pickupMode: "now",
    deliveryMode: "scheduled",
    deliveryDeadline: deadline,
    deliveryFeeMop: Number(input.deliveryFeeMop ?? 28),
    urgent: Boolean(input.urgent),
    currency: "MOP",
    shop: {
      externalShopId: `MANUAL-SHOP-${suffix}`,
      name: input.shop.name,
      address: input.shop.address,
      latitude: Number(input.shop.latitude),
      longitude: Number(input.shop.longitude),
      contactName: input.shop.contactName?.trim() || "店員",
      contactPhone: input.shop.contactPhone?.trim() || "+85328990000"
    },
    customer: {
      externalCustomerId: `MANUAL-CUSTOMER-${suffix}`,
      name: input.customer.name?.trim() || "客戶",
      phone: input.customer.phone?.trim() || "+85366110000",
      address: input.customer.address,
      latitude: Number(input.customer.latitude),
      longitude: Number(input.customer.longitude),
      deliveryNote: input.customer.deliveryNote?.trim() || "到達後請致電。"
    },
    items: [{ name: "手動測試商品", quantity: 1 }],
    notes: {
      shopNote: "此訂單由後台手動建立。",
      driverNote: "請依照手動輸入地址與座標導航。",
      paymentBy: input.paymentBy ?? "customer"
    },
    callback: {
      url: `${callbackBaseUrl}/api/integration/delivery/siteb/callback`,
      headers: {
        "X-SiteA-Key": "sitea-demo-key"
      }
    }
  };
}

export async function POST(request: Request) {
  const sessionUser = getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ message: "未登入後台。" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ({ count?: number } | ManualCreateOrderBody);
    const count = Math.max(1, Math.min(10, Number((body as { count?: number }).count ?? 1)));
    const callbackBaseUrl = new URL(request.url).origin;

    if ("mode" in body && body.mode === "manual") {
      const result = await createOrSyncOrder(buildManualOrder(body, callbackBaseUrl));
      return NextResponse.json({
        success: true,
        callbackBaseUrl,
        created: [result]
      });
    }

    const created = [];
    for (let index = 0; index < count; index += 1) {
      const result = await createOrSyncOrder(buildRandomOrder(index, callbackBaseUrl));
      created.push(result);
    }

    return NextResponse.json({
      success: true,
      callbackBaseUrl,
      created
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "建立測試訂單失敗。"
      },
      { status: 500 }
    );
  }
}
