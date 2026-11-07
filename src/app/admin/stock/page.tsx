
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
};

type StockItem = {
  id: string;
  product_id: string;
  duration: string;
  key_value: string;
  used: boolean;
};

const durations = [
  "1 ชั่วโมง",
  "3 ชั่วโมง",
  "6 ชั่วโมง",
  "12 ชั่วโมง",
  "1 วัน",
  "3 วัน",
  "7 วัน",
  "15 วัน",
  "30 วัน",
];

export default function AdminStock() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [productId, setProductId] = useState("");
  const [duration, setDuration] = useState("1 ชั่วโมง");
  const [keyValue, setKeyValue] = useState("");
  const [message, setMessage] = useState("กำลังโหลด...");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    if (!supabase) return;

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      window.location.href = "/";
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();

    if (profile?.role !== "admin") {
      setMessage("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
      return;
    }

    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("id, name")
      .order("name");

    if (productError) {
      setMessage(productError.message);
      return;
    }

    setProducts(productData || []);

    if (!productId && productData?.length) {
      setProductId(productData[0].id);
    }

    const { data: stockData, error: stockError } = await supabase
      .from("key_inventory")
      .select("id, product_id, duration, key_value, used")
      .order("created_at", { ascending: false });

    if (stockError) {
      setMessage(stockError.message);
      return;
    }

    setStock(stockData || []);
    setMessage("");
  }

  useEffect(() => {
    loadData();
  }, []);

  async function addKey() {
    if (!supabase || loading) return;

    if (!productId) {
      setMessage("กรุณาเลือกสินค้า");
      return;
    }

    if (!keyValue.trim()) {
      setMessage("กรุณากรอก KEY");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("key_inventory")
      .insert({
        product_id: productId,
        duration,
        key_value: keyValue.trim(),
        used: false,
      });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setKeyValue("");
    setMessage("เพิ่ม KEY สำเร็จ");
    await loadData();
  }

  const grouped = durations.map((d) => ({
    duration: d,
    items: stock.filter(
      (item) => item.product_id === productId && item.duration === d
    ),
  }));

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: 12,
    margin: "8px 0 16px",
    borderRadius: 8,
    border: "1px solid #51436b",
    background: "#211a30",
    color: "white",
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "#100d19",
      color: "white",
      padding: 24,
      fontFamily: "Arial, sans-serif",
    }}>
      <div style={{ maxWidth: 900, margin: "auto" }}>
        <h1 style={{ color: "#b58aff" }}>DUDSHOP777</h1>
        <h2>จัดการสต็อก KEY</h2>

        <section style={{
          background: "#1b1528",
          border: "1px solid #49365f",
          borderRadius: 12,
          padding: 20,
        }}>
          <h3>เพิ่ม KEY เข้าสต็อก</h3>

          <label>เลือกสินค้า</label>
          <select
            style={inputStyle}
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <label>เลือกระยะเวลา</label>
          <select
            style={inputStyle}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          >
            {durations.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <label>KEY</label>
          <textarea
            style={{ ...inputStyle, minHeight: 100 }}
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            placeholder="วาง KEY ที่นี่"
          />

          <button
            onClick={addKey}
            disabled={loading || products.length === 0}
            style={{
              background: "#8b5cf6",
              color: "white",
              padding: 12,
              border: 0,
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            {loading ? "กำลังบันทึก..." : "เพิ่ม KEY"}
          </button>

          {message && <p>{message}</p>}
        </section>

        <h2 style={{ marginTop: 28 }}>จำนวน KEY คงเหลือ</h2>

        {products.length === 0 && (
          <p>ยังไม่มีสินค้า กรุณาเพิ่มสินค้าก่อน</p>
        )}

        {grouped.map((group) => (
          <section key={group.duration} style={{
            background: "#1b1528",
            border: "1px solid #49365f",
            borderRadius: 10,
            padding: 16,
            marginTop: 10,
          }}>
            <b>{group.duration}</b>
            <p>
              คงเหลือ: {group.items.filter((item) => !item.used).length} KEY
            </p>
            <p>
              ใช้แล้ว: {group.items.filter((item) => item.used).length} KEY
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
