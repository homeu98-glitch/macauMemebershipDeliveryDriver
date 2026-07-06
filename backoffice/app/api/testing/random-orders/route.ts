import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../lib/auth";
import { createOrSyncOrder, type CreateOrderInput } from "../../../../lib/siteb-order-api";

const shopSamples = [
  {
    name: "金旺茶餐廳",
    address: "澳門高士德大馬路 118 號",
    latitude: 22.2061,
    longitude: 113.5458,
    contactName: "店員",
    contactPhone: "+85328990011"
  },
  {
    name: "海景粉麵店",
    address: "澳門新口岸友誼大馬路 82 號",
    latitude: 22.1924,
    longitude: 113.5523,
    contactName: "收銀",
    contactPhone: "+85328990022"
  },
  {
    name: "南灣咖啡室",
    address: "澳門南灣大馬路 33 號",
    latitude: 22.1889,
    longitude: 113.5405,
    contactName: "前台",
    contactPhone: "+85328990033"
  }
];

const customerSamples = [
  {
    name: "陳先生",
    phone: "+85366110001",
    address: "氹仔中央公園附近",
    latitude: 22.1578,
    longitude: 113.5601,
    deliveryNote: "到樓下先致電。"
  },
  {
    name: "李小姐",
    phone: "+85366110002",
    address: "黑沙環海濱花園 2 座",
    latitude: 22.2112,
    longitude: 113.5521,
    deliveryNote: "放管理處。"
  },
  {
    name: "黃先生",
    phone: "+85366110003",
    address: "筷子基宏建宏開大廈",
    latitude: 22.2032,
    longitude: 113.5352,
    deliveryNote: "請保持熱湯直立。"
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

function buildRandomOrder(index: number): CreateOrderInput {
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
    urgent: index % 2 === 0,
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
      driverNote: "請優先檢查資料流與通知。"
    },
    callback: {
      url: "https://sitea.example.com/api/siteb/callbacks/order-status",
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
    const body = (await request.json()) as { count?: number };
    const count = Math.max(1, Math.min(10, Number(body.count ?? 1)));

    const created = [];
    for (let index = 0; index < count; index += 1) {
      const result = await createOrSyncOrder(buildRandomOrder(index));
      created.push(result);
    }

    return NextResponse.json({
      success: true,
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
