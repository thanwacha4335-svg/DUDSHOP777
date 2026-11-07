
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

type Product = {
  id: string;
  name: string;
};

export default function AdminPrices() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("กำลังโหลด...");
  const [loading, setLoading] = useState(false);

  async function loadProducts() {
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

    const { data, error } = await supabase
      .from("products")
      .select("id, name")
      .order("name");

    if (error) {
      setMessage(error.message);
      return;
    }

    setProducts(data || []);

    if (data?.length) {
      setProductId((current) => current || data[0].id);
    }

    setMessage("");
  }

  async function loadPrices(id: string) {
    if (!supabase || !id) return;

    const { data, error } = await supabase
      .from("product_duration_prices")
      .select("duration, price_points")
      .eq("product_id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    const next: Record<string, string> = {};

    durations.forEach((duration) => {
      next[duration] = "";
    });

    data?.forEach((item) => {
      next[item.duration] = String(item.price_points);
    });

    setPrices(next);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (productId) loadPrices(productId);
  }, [productId]);

  async function savePrices() {
    if (!supabase || !productId || loading) return;

    const rows = [];

    for (const duration of durations) {
      const value = prices[duration];

      if (value === undefined || value.trim() === "") continue;

      const price = Number(value);

      if (!Number.isInteger(price) || price < 0) {
        setMessage("กรุณาใส่ราคาเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป");
        return;
      }

      rows.push({
        product_id: productId,
        duration,
        price_points: price,
      });
    }

    if (rows.length === 0) {
      setMessage("กรุณากรอกราคาอย่างน้อย 1 ระยะเวลา");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("product_duration_prices")
      .upsert(rows, {
        onConflict: "product_id,duration",
      });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("บันทึกราคาสำเร็จ");
    await loadPrices(productId);
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: 12,
    marginTop: 6,
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
      <div style={{ maxWidth: 700, margin: "auto" }}>
        <h1 style={{ color: "#b58aff" }}>DUDSHOP777</h1>
        <h2>จัดการราคาตามระยะเวลา</h2>

        <section style={{
          background: "#1b1528",
          border: "1px solid #49365f",
          borderRadius: 12,
          padding: 20,
        }}>
          <label>เลือกสินค้า</label>
          <select
            style={inputStyle}
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>

          <h3 style={{ marginTop: 24 }}>กำหนดราคาแต่ละระยะเวลา</h3>

          {durations.map((duration) => (
            <div key={duration} style={{ marginBottom: 14 }}>
              <label>{duration}</label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="กรอกราคาเครดิต"
                style={inputStyle}
                value={prices[duration] ?? ""}
                onChange={(e) =>
                  setPrices((current) => ({
                    ...current,
                    [duration]: e.target.value,
                  }))
                }
              />
            </div>
          ))}

          <button
            onClick={savePrices}
            disabled={loading || products.length === 0}
            style={{
              width: "100%",
              background: "#8b5cf6",
              color: "white",
              padding: 14,
              border: 0,
              borderRadius: 8,
              cursor: "pointer",
              marginTop: 12,
            }}
          >
            {loading ? "กำลังบันทึก..." : "บันทึกราคา"}
          </button>

          {message && <p>{message}</p>}
        </section>
      </div>
    </main>
  );
}
