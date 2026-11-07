
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const durations = [
  "1 ชั่วโมง", "3 ชั่วโมง", "6 ชั่วโมง", "12 ชั่วโมง",
  "1 วัน", "3 วัน", "7 วัน", "15 วัน", "30 วัน",
];

type PanelKey = "reseller_300" | "reseller_1000";

type Product = {
  id: string;
  name: string;
  category?: string;
  description?: string;
};

type Price = {
  duration: string;
  price_points: number;
};

type GeneratedKey = {
  id: string;
  product_id?: string;
  product_name: string;
  duration: string;
  key_value: string;
  price_points: number;
  created_at: string;
};

export default function Dashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("สมาชิก");
  const [points, setPoints] = useState(0);
  const [role, setRole] = useState("member");
  const [assignedPanel, setAssignedPanel] = useState<PanelKey | null>(null);

  const [keysGenerated, setKeysGenerated] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);

  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [prices, setPrices] = useState<Price[]>([]);
  const [duration, setDuration] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [stock, setStock] = useState(0);

  const [purchasing, setPurchasing] = useState(false);
  const [message, setMessage] = useState("");
  const [generatedKeys, setGeneratedKeys] = useState<GeneratedKey[]>([]);

  const [history, setHistory] = useState<GeneratedKey[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showKeys, setShowKeys] = useState<string[]>([]);

  const panelName =
    assignedPanel === "reseller_300"
      ? "แผงตัวแทน 300"
      : assignedPanel === "reseller_1000"
      ? "แผงตัวแทน 1000"
      : "ยังไม่ได้รับการกำหนดแผง";

  const selectedPrice = prices.find(
    (item) => item.duration === duration
  );

  const totalPrice = selectedPrice
    ? selectedPrice.price_points * quantity
    : 0;

  async function loadProfile(): Promise<PanelKey | null> {
    if (!supabase) return null;

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      router.replace("/");
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("username, role, points, assigned_panel")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (error) {
      setMessage("โหลดข้อมูลสมาชิกไม่สำเร็จ: " + error.message);
      return null;
    }

    if (data) {
      setUsername(data.username || auth.user.email || "สมาชิก");
      setPoints(Number(data.points || 0));
      setRole(data.role || "member");

      const panel =
        data.assigned_panel === "reseller_300" ||
        data.assigned_panel === "reseller_1000"
          ? data.assigned_panel
          : null;

      setAssignedPanel(panel);
      return panel;
    }

    return null;
  }

  async function loadStats() {
    if (!supabase) return;

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const [keysResult, ordersResult] = await Promise.all([
      supabase
        .from("generated_keys")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.user.id),

      supabase
        .from("credit_transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.user.id)
        .eq("transaction_type", "purchase")
        .eq("status", "approved"),
    ]);

    if (!keysResult.error) {
      setKeysGenerated(keysResult.count || 0);
    }

    if (!ordersResult.error) {
      setTotalOrders(ordersResult.count || 0);
    }
  }

  async function loadProducts(panel: PanelKey | null) {
    if (!supabase) return;

    setProducts([]);
    setProductId("");
    setPrices([]);
    setDuration("");
    setStock(0);

    if (!panel) {
      setMessage("บัญชีนี้ยังไม่ได้รับการกำหนดแผง กรุณาติดต่อแอดมิน");
      return;
    }

    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("id, name, category, description")
      .eq("active", true)
      .order("name");

    if (productError) {
      setMessage("โหลดสินค้าไม่สำเร็จ: " + productError.message);
      return;
    }

    const { data: priceData, error: priceError } = await supabase
      .from("product_panel_duration_prices")
      .select("product_id")
      .eq("panel_key", panel);

    if (priceError) {
      setMessage("โหลดข้อมูลแผงไม่สำเร็จ: " + priceError.message);
      return;
    }

    const availableProductIds = new Set(
      (priceData || []).map((item) => item.product_id)
    );

    const filteredProducts = (productData || []).filter((product) =>
      availableProductIds.has(product.id)
    );

    setProducts(filteredProducts);

    if (filteredProducts.length > 0) {
      setProductId(filteredProducts[0].id);
      setMessage("");
    } else {
      setMessage("ยังไม่มีสินค้าเปิดขายในแผงนี้");
    }
  }

  async function loadPrices(id: string, panel: PanelKey | null) {
    if (!supabase || !id || !panel) return;

    setPrices([]);
    setDuration("");
    setStock(0);

    const { data, error } = await supabase
      .from("product_panel_duration_prices")
      .select("duration, price_points")
      .eq("product_id", id)
      .eq("panel_key", panel);

    if (error) {
      setMessage("โหลดราคาไม่สำเร็จ: " + error.message);
      return;
    }

    const sorted = durations
      .map((item) => data?.find((price) => price.duration === item))
      .filter((item): item is Price => Boolean(item));

    setPrices(sorted);

    if (sorted.length) {
      setDuration(sorted[0].duration);
      setQuantity(1);
    }
  }

  async function loadStock(id: string, selectedDuration: string) {
    if (!supabase || !id || !selectedDuration) return;

    const { count, error } = await supabase
      .from("key_inventory")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id)
      .eq("duration", selectedDuration)
      .eq("used", false);

    if (!error) {
      setStock(count || 0);
      setQuantity(1);
    }
  }

  async function loadHistory() {
    if (!supabase) return;

    setHistoryLoading(true);

    const { data, error } = await supabase
      .from("generated_keys")
      .select("id, product_id, product_name, duration, key_value, price_points, created_at")
      .order("created_at", { ascending: false });

    setHistoryLoading(false);

    if (error) {
      setMessage("โหลดประวัติไม่สำเร็จ: " + error.message);
      return;
    }

    setHistory(data || []);
  }

  useEffect(() => {
    async function start() {
      if (!supabase) {
        router.replace("/");
        return;
      }

      const { data: auth, error } = await supabase.auth.getUser();

      if (error || !auth.user) {
        router.replace("/");
        return;
      }

      const panel = await loadProfile();

      await Promise.all([
        loadProducts(panel),
        loadHistory(),
        loadStats(),
      ]);

      setLoading(false);
    }

    start();
  }, [router]);

  useEffect(() => {
    if (productId && assignedPanel) {
      loadPrices(productId, assignedPanel);
    }
  }, [productId, assignedPanel]);

  useEffect(() => {
    if (productId && duration) {
      loadStock(productId, duration);
    }
  }, [productId, duration]);

  async function logout() {
    if (!supabase) return;

    await supabase.auth.signOut();
    router.replace("/");
  }

  async function purchase() {
    if (!supabase || purchasing) return;

    if (!assignedPanel) {
      setMessage("บัญชีนี้ยังไม่ได้รับการกำหนดแผง");
      return;
    }

    if (!productId || !duration || !selectedPrice) {
      setMessage("กรุณาเลือกสินค้าและระยะเวลา");
      return;
    }

    if (quantity < 1 || quantity > 10) {
      setMessage("จำนวนคีย์ต้องอยู่ระหว่าง 1 ถึง 10");
      return;
    }

    if (quantity > stock) {
      setMessage("สต็อกคีย์ไม่เพียงพอ");
      return;
    }

    if (points < totalPrice) {
      setMessage("เครดิตของคุณไม่เพียงพอ");
      return;
    }

    const confirmed = window.confirm(
      `ยืนยันการซื้อ ${quantity} คีย์ ราคา ${totalPrice.toLocaleString("th-TH")} เครดิต ใช่หรือไม่?`
    );

    if (!confirmed) return;

    setPurchasing(true);
    setMessage("");
    setGeneratedKeys([]);

    const { data, error } = await supabase.rpc(
      "generate_product_keys",
      {
        p_product_id: productId,
        p_quantity: quantity,
        p_duration: duration,
        p_panel_key: assignedPanel,
      }
    );

    setPurchasing(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setGeneratedKeys(data || []);
    setMessage("ซื้อสำเร็จ!");

    await loadProfile();
    await loadStock(productId, duration);
    await loadHistory();
    await loadStats();
  }

  async function copyKey(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("คัดลอก KEY สำเร็จ");
    } catch {
      setMessage("คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง");
    }
  }

  function toggleKey(id: string) {
    setShowKeys((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  if (loading) {
    return <main className="shell">กำลังโหลดข้อมูล...</main>;
  }

  return (
    <main className="shell">
      <nav className="nav">
        <div className="brand">
          <span>DUD</span>SHOP777
        </div>
        <button onClick={logout}>ออกจากระบบ</button>
      </nav>

      <section className="hero">
        <p className="eyebrow">MEMBER DASHBOARD</p>
        <h1>WELCOME <span>BACK</span></h1>
        <p className="sub">ยินดีต้อนรับ {username}</p>

        <div className="statsGrid">
          <div className="statCard">
            <p className="statLabel">KEY GENERATED</p>
            <h2>{keysGenerated.toLocaleString("th-TH")}</h2>
            <p className="statDescription">จำนวน KEY ที่สร้างทั้งหมด</p>
          </div>

          <div className="statCard">
            <p className="statLabel">TOTAL ORDERS</p>
            <h2>{totalOrders.toLocaleString("th-TH")}</h2>
            <p className="statDescription">จำนวนครั้งที่สั่งซื้อทั้งหมด</p>
          </div>
        </div>

        <div className="panel">
          <h2>ข้อมูลสมาชิก</h2>
          <p>ชื่อสมาชิก: {username}</p>
          <p>เครดิตคงเหลือ: {points.toLocaleString("th-TH")}</p>
          <p>สถานะบัญชี: {role}</p>
          <p>แผงสมาชิก: <strong style={{ color: "#d69cff" }}>{panelName}</strong></p>
        </div>

        <div className="panel">
          <h2>ร้านค้า DUDSHOP777</h2>

          {!assignedPanel ? (
            <p>บัญชีนี้ยังไม่ได้รับการกำหนดแผง กรุณาติดต่อแอดมิน</p>
          ) : products.length === 0 ? (
            <p>{message || "ยังไม่มีสินค้าเปิดขายในแผงนี้"}</p>
          ) : (
            <>
              <label>เลือกสินค้า</label>
              <select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setGeneratedKeys([]);
                  setMessage("");
                }}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>

              {products.find((p) => p.id === productId)?.description && (
                <p>{products.find((p) => p.id === productId)?.description}</p>
              )}

              <label>เลือกระยะเวลา</label>
              <select
                value={duration}
                onChange={(e) => {
                  setDuration(e.target.value);
                  setGeneratedKeys([]);
                  setMessage("");
                }}
              >
                {prices.map((item) => (
                  <option key={item.duration} value={item.duration}>
                    {item.duration} - {item.price_points.toLocaleString("th-TH")} เครดิต
                  </option>
                ))}
              </select>

              {prices.length === 0 && (
                <p>สินค้านี้ยังไม่ได้กำหนดราคาในแผงของคุณ</p>
              )}

              {selectedPrice && (
                <>
                  <p>ราคาต่อคีย์: {selectedPrice.price_points.toLocaleString("th-TH")} เครดิต</p>
                  <p>สต็อกคงเหลือ: {stock} คีย์</p>

                  <label>จำนวนคีย์</label>
                  <select
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
                      .filter((n) => n <= stock)
                      .map((n) => (
                        <option key={n} value={n}>
                          {n} คีย์
                        </option>
                      ))}
                  </select>

                  <h3>รวมทั้งหมด: {totalPrice.toLocaleString("th-TH")} เครดิต</h3>

                  <button
                    onClick={purchase}
                    disabled={purchasing || stock < 1}
                  >
                    {purchasing ? "กำลังดำเนินการ..." : "ซื้อสินค้า"}
                  </button>
                </>
              )}
            </>
          )}

          {message && <p>{message}</p>}
        </div>

        {generatedKeys.length > 0 && (
          <div className="panel">
            <h2>KEY ที่ซื้อสำเร็จ</h2>
            {generatedKeys.map((item) => (
              <div key={item.id} style={keyCardStyle}>
                <p>{item.product_name}</p>
                <p>{item.duration}</p>
                <strong>{item.key_value}</strong>
                <button onClick={() => copyKey(item.key_value)}>
                  คัดลอก KEY
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h2>ประวัติการซื้อและ KEY</h2>
            <button onClick={loadHistory} disabled={historyLoading}>
              {historyLoading ? "กำลังโหลด..." : "รีเฟรช"}
            </button>
          </div>

          {historyLoading ? (
            <p>กำลังโหลดประวัติ...</p>
          ) : history.length === 0 ? (
            <p>ยังไม่มีประวัติการซื้อ</p>
          ) : (
            history.map((item) => (
              <div key={item.id} style={keyCardStyle}>
                <p><strong>{item.product_name}</strong></p>
                <p>ระยะเวลา: {item.duration}</p>
                <p>ราคา: {Number(item.price_points).toLocaleString("th-TH")} เครดิต</p>
                <p>วันที่ซื้อ: {new Date(item.created_at).toLocaleString("th-TH")}</p>

                <p style={{ overflowWrap: "anywhere" }}>
                  KEY: {showKeys.includes(item.id) ? item.key_value : "••••••••••••"}
                </p>

                <button onClick={() => toggleKey(item.id)}>
                  {showKeys.includes(item.id) ? "ซ่อน KEY" : "แสดง KEY"}
                </button>

                <button onClick={() => copyKey(item.key_value)}>
                  คัดลอก KEY
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <footer>© 2026 DUDSHOP777</footer>

      <style jsx>{`
        .statsGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin: 24px 0;
        }

        .statCard {
          background: linear-gradient(145deg, #21152f, #120f1b);
          border: 1px solid #633b7c;
          border-radius: 14px;
          padding: 20px;
          min-width: 0;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }

        .statLabel {
          color: #d69cff;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.5px;
          margin: 0 0 12px;
        }

        .statCard h2 {
          color: #ffffff;
          font-size: 32px;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .statDescription {
          color: #b9a9c7;
          font-size: 12px;
          margin: 8px 0 0;
        }

        @media (max-width: 520px) {
          .statsGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

const keyCardStyle = {
  padding: 12,
  marginBottom: 10,
  background: "#211a30",
  borderRadius: 8,
  overflowWrap: "anywhere" as const,
};
