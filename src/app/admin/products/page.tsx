
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  price_points: number;
  active: boolean;
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("กำลังโหลดสินค้า...");
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
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setProducts(data || []);
    setMessage("");
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function clearForm() {
    setName("");
    setCategory("");
    setDescription("");
    setPrice("");
    setEditingId(null);
  }

  async function saveProduct() {
    if (!supabase || loading) return;

    const priceNumber = Number(price);

    if (!name.trim() || !category.trim()) {
      setMessage("กรุณากรอกชื่อสินค้าและหมวดหมู่");
      return;
    }

    if (!Number.isSafeInteger(priceNumber) || priceNumber < 0) {
      setMessage("กรุณากรอกราคาเครดิตเป็นจำนวนเต็มที่ถูกต้อง");
      return;
    }

    setLoading(true);
    setMessage("");

    const productData = {
      name: name.trim(),
      category: category.trim(),
      description: description.trim(),
      price_points: priceNumber,
    };

    const result = editingId
      ? await supabase
          .from("products")
          .update(productData)
          .eq("id", editingId)
      : await supabase
          .from("products")
          .insert({ ...productData, active: true });

    setLoading(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setMessage(editingId ? "แก้ไขสินค้าสำเร็จ" : "เพิ่มสินค้าสำเร็จ");
    clearForm();
    await loadProducts();
  }

  function editProduct(product: Product) {
    setEditingId(product.id);
    setName(product.name);
    setCategory(product.category);
    setDescription(product.description || "");
    setPrice(String(product.price_points));
    setMessage("");
  }

  async function toggleProduct(product: Product) {
    if (!supabase || loading) return;

    setLoading(true);

    const { error } = await supabase
      .from("products")
      .update({ active: !product.active })
      .eq("id", product.id);

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(product.active ? "ปิดการขายสินค้าแล้ว" : "เปิดการขายสินค้าแล้ว");
    await loadProducts();
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: 12,
    margin: "7px 0 14px",
    borderRadius: 8,
    border: "1px solid #51436b",
    background: "#211a30",
    color: "white",
  };

  const buttonStyle = {
    padding: "11px 16px",
    border: 0,
    borderRadius: 8,
    background: "#8b5cf6",
    color: "white",
    cursor: "pointer",
    marginRight: 8,
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
        <h2>จัดการสินค้า</h2>

        <section style={{
          background: "#1b1528",
          padding: 20,
          borderRadius: 12,
          border: "1px solid #49365f",
        }}>
          <h3>{editingId ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</h3>

          <label>ชื่อสินค้า</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อสินค้า"
          />

          <label>หมวดหมู่</label>
          <input
            style={inputStyle}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="เช่น iOS, Android"
          />

          <label>รายละเอียด</label>
          <textarea
            style={{ ...inputStyle, minHeight: 80 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="รายละเอียดสินค้า"
          />

          <label>ราคา (เครดิต)</label>
          <input
            style={inputStyle}
            type="number"
            min="0"
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="เช่น 100"
          />

          <button
            style={buttonStyle}
            onClick={saveProduct}
            disabled={loading}
          >
            {loading ? "กำลังบันทึก..." : editingId ? "บันทึกการแก้ไข" : "เพิ่มสินค้า"}
          </button>

          {editingId && (
            <button style={buttonStyle} onClick={clearForm}>
              ยกเลิก
            </button>
          )}

          {message && <p>{message}</p>}
        </section>

        <h2 style={{ marginTop: 30 }}>รายการสินค้าทั้งหมด</h2>

        {products.map((product) => (
          <section key={product.id} style={{
            background: "#1b1528",
            border: "1px solid #49365f",
            borderRadius: 12,
            padding: 18,
            marginTop: 12,
          }}>
            <h3>{product.name}</h3>
            <p>หมวดหมู่: {product.category}</p>
            <p>ราคา: {product.price_points} เครดิต</p>
            <p>สถานะ: {product.active ? "กำลังขาย" : "ปิดการขาย"}</p>

            <button
              style={buttonStyle}
              onClick={() => editProduct(product)}
            >
              แก้ไข
            </button>

            <button
              style={{
                ...buttonStyle,
                background: product.active ? "#a33b4b" : "#26865c",
              }}
              onClick={() => toggleProduct(product)}
              disabled={loading}
            >
              {product.active ? "ปิดการขาย" : "เปิดการขาย"}
            </button>
          </section>
        ))}
      </div>
    </main>
  );
}
