
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const durations = [
  "1 ชั่วโมง", "3 ชั่วโมง", "6 ชั่วโมง", "12 ชั่วโมง",
  "1 วัน", "3 วัน", "7 วัน", "15 วัน", "30 วัน",
];

type PanelKey = "reseller_300" | "reseller_1000";

type Product = {
  id: string;
  name: string;
  description?: string;
};

type Price = {
  duration: string;
  price_points: number;
};

type GeneratedKey = {
  id: string;
  product_name: string;
  duration: string;
  key_value: string;
};

export default function KeyGeneratorPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("สมาชิก");
  const [points, setPoints] = useState(0);
  const [assignedPanel, setAssignedPanel] = useState<PanelKey | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [prices, setPrices] = useState<Price[]>([]);
  const [duration, setDuration] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [stock, setStock] = useState(0);

  const [purchasing, setPurchasing] = useState(false);
  const [message, setMessage] = useState("");
  const [generatedKeys, setGeneratedKeys] = useState<GeneratedKey[]>([]);

  const selectedPrice = prices.find((item) => item.duration === duration);
  const totalPrice = selectedPrice ? selectedPrice.price_points * quantity : 0;

  const panelName =
    assignedPanel === "reseller_300"
      ? "แผงตัวแทน 300"
      : assignedPanel === "reseller_1000"
      ? "แผงตัวแทน 1000"
      : "ยังไม่ได้รับการกำหนดแผง";

  async function loadProfile(): Promise<PanelKey | null> {
    if (!supabase) return null;

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      router.replace("/");
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("username, points, assigned_panel")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (error) {
      setMessage("โหลดข้อมูลสมาชิกไม่สำเร็จ: " + error.message);
      return null;
    }

    setUsername(data?.username || auth.user.email || "สมาชิก");
    setPoints(Number(data?.points || 0));

    const panel =
      data?.assigned_panel === "reseller_300" ||
      data?.assigned_panel === "reseller_1000"
        ? data.assigned_panel
        : null;

    setAssignedPanel(panel);
    return panel;
  }

  async function loadProducts(panel: PanelKey | null) {
    if (!supabase || !panel) return;

    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("id, name, description")
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

    const availableIds = new Set(
      (priceData || []).map((item) => item.product_id)
    );

    const filtered = (productData || []).filter((item) =>
      availableIds.has(item.id)
    );

    setProducts(filtered);

    if (filtered.length > 0) {
      setProductId(filtered[0].id);
      setMessage("");
    } else {
      setProductId("");
      setMessage("ยังไม่มีสินค้าเปิดขายในแผงนี้");
    }
  }

  async function loadPrices(id: string, panel: PanelKey) {
    if (!supabase || !id) return;

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

    if (sorted.length > 0) {
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

  useEffect(() => {
    async function start() {
      if (!supabase) {
        router.replace("/");
        return;
      }

      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        router.replace("/");
        return;
      }

      const panel = await loadProfile();

      if (panel) {
        await loadProducts(panel);
      }

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
  }

  async function copyKey(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("คัดลอก KEY สำเร็จ");
    } catch {
      setMessage("คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง");
    }
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

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/dashboard"><button>Dashboard</button></Link>
          <Link href="/key-generator"><button>Key Generator</button></Link>
          <Link href="/history"><button>History</button></Link>
          <button onClick={logout}>ออกจากระบบ</button>
        </div>
      </nav>

      <section className="hero">
        <p className="eyebrow">KEY GENERATOR</p>
        <h1>GENERATE <span>KEY</span></h1>
        <p className="sub">เลือกสินค้าและระยะเวลาเพื่อสร้าง KEY</p>

        <div className="panel">
          <h2>ข้อมูลสมาชิก</h2>
          <p>สมาชิก: {username}</p>
          <p>เครดิตคงเหลือ: {points.toLocaleString("th-TH")}</p>
          <p>แผงสมาชิก: <strong style={{ color: "#d69cff" }}>{panelName}</strong></p>
        </div>

        <div className="panel">
          <h2>เลือกสินค้า</h2>

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

          {message && <p className="message">{message}</p>}
        </div>

        {generatedKeys.length > 0 && (
          <div className="panel">
            <h2>KEY ที่ซื้อสำเร็จ</h2>
            {generatedKeys.map((item) => (
              <div key={item.id} style={keyCardStyle}>
                <p>{item.product_name}</p>
                <p>{item.duration}</p>
                <strong style={{ overflowWrap: "anywhere" }}>
                  {item.key_value}
                </strong>
                <button onClick={() => copyKey(item.key_value)}>
                  คัดลอก KEY
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer>© 2026 DUDSHOP777</footer>
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
