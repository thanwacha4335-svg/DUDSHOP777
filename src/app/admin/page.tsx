
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Tab = "home" | "members" | "products" | "stock" | "prices" | "sales";

type Member = {
  id: string;
  username: string | null;
  role: string;
  points: number;
  assigned_panel: string | null;
};

type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  price_points: number;
  active: boolean;
  image_url: string | null;
};

type StockItem = {
  id: string;
  product_id: string;
  duration: string;
  used: boolean;
};

type Sale = {
  id: string;
  product_name: string;
  duration: string;
  price_points: number;
  created_at: string;
  panel_key: string | null;
};

const durations = [
  "1 ชั่วโมง", "3 ชั่วโมง", "6 ชั่วโมง", "12 ชั่วโมง",
  "1 วัน", "3 วัน", "7 วัน", "15 วัน", "30 วัน",
];

const panelOptions = [
  { value: "reseller_300", label: "แผงตัวแทน 300" },
  { value: "reseller_1000", label: "แผงตัวแทน 1000" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  margin: "7px 0 14px",
  borderRadius: 8,
  border: "1px solid #383838",
  background: "#171717",
  color: "white",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  padding: "11px 16px",
  border: 0,
  borderRadius: 8,
  background: "#dc2626",
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
};

const cardStyle: React.CSSProperties = {
  background: "#151515",
  border: "1px solid #303030",
  borderRadius: 12,
  padding: 18,
  marginBottom: 14,
};

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("home");
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  const [search, setSearch] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // ระบบรูปสินค้า
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const [removeImage, setRemoveImage] = useState(false);

  const [stockProduct, setStockProduct] = useState("");
  const [stockDuration, setStockDuration] = useState("1 ชั่วโมง");
  const [keyText, setKeyText] = useState("");

  const [priceProduct, setPriceProduct] = useState("");
  const [pricePanel, setPricePanel] = useState("reseller_300");
  const [prices, setPrices] = useState<Record<string, string>>({});

  const [stats, setStats] = useState({
    members: 0,
    products: 0,
    keys: 0,
    sold: 0,
  });

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (allowed) {
      if (tab === "members") loadMembers();
      if (tab === "products") loadProducts();
      if (tab === "stock") loadStock();
      if (tab === "prices") loadProducts();
      if (tab === "sales") loadSales();
    }
  }, [tab, allowed]);

  useEffect(() => {
    if (allowed && priceProduct) loadPrices(priceProduct, pricePanel);
  }, [priceProduct, pricePanel, allowed]);

  // ล้าง URL ตัวอย่างรูปเมื่อเปลี่ยนรูปหรือออกจากหน้า
  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  async function checkAdmin() {
    if (!supabase) {
      setMessage("ไม่สามารถเชื่อมต่อฐานข้อมูลได้");
      setChecking(false);
      return;
    }

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      window.location.href = "/";
      return;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("username, role")
      .eq("id", auth.user.id)
      .single();

    if (error || profile?.role !== "admin") {
      setAllowed(false);
      setMessage("คุณไม่มีสิทธิ์เข้าถึงระบบหลังบ้าน");
      setChecking(false);
      return;
    }

    setAdminName(profile.username || "Admin");
    setAllowed(true);
    await loadOverview();
    setChecking(false);
  }

  async function loadOverview() {
    if (!supabase) return;

    const [m, p, k, s] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "member"),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("key_inventory").select("id", { count: "exact", head: true }).eq("used", false),
      supabase.from("generated_keys").select("id", { count: "exact", head: true }),
    ]);

    setStats({
      members: m.count || 0,
      products: p.count || 0,
      keys: k.count || 0,
      sold: s.count || 0,
    });
  }

  async function loadMembers() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, role, points, assigned_panel")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMembers(data || []);
    setMessage("");
  }

  async function adjustCredit(userId: string) {
    if (!supabase || loading) return;

    const amount = Number(amounts[userId]);

    if (!Number.isSafeInteger(amount) || amount === 0) {
      setMessage("กรุณาใส่จำนวนเครดิตที่ถูกต้อง");
      return;
    }

    if (!window.confirm(
      `${amount > 0 ? "เพิ่ม" : "ลด"}เครดิต ${Math.abs(amount)} เครดิต ใช่หรือไม่?`
    )) return;

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.rpc("admin_adjust_credit", {
      p_user_id: userId,
      p_amount: amount,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(`สำเร็จ เครดิตคงเหลือ ${data}`);
      setAmounts((old) => ({ ...old, [userId]: "" }));
      await loadMembers();
      await loadOverview();
    }

    setLoading(false);
  }

  async function changePanel(userId: string, panel: string) {
    if (!supabase || loading || !panel) return;

    const name = panelOptions.find((p) => p.value === panel)?.label || panel;

    if (!window.confirm(`กำหนดสมาชิกเป็น ${name} ใช่หรือไม่?`)) return;

    setLoading(true);

    const { error } = await supabase.rpc("admin_set_member_panel", {
      p_user_id: userId,
      p_panel_key: panel,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("เปลี่ยนแผงสมาชิกสำเร็จ");
      await loadMembers();
    }

    setLoading(false);
  }

  async function loadProducts() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setProducts((data || []) as Product[]);

    if (data?.length) {
      setStockProduct((old) => old || data[0].id);
      setPriceProduct((old) => old || data[0].id);
    }
  }

  function clearProductForm() {
    setProductName("");
    setCategory("");
    setDescription("");
    setEditingId(null);
    setImageFile(null);
    setImagePreview("");
    setCurrentImageUrl("");
    setRemoveImage(false);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setMessage("รองรับเฉพาะไฟล์ JPG, PNG และ WebP");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("รูปภาพต้องมีขนาดไม่เกิน 5 MB");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveImage(false);
    setMessage("");
  }

  async function uploadProductImage(): Promise<string | null> {
    if (!supabase || !imageFile) return null;

    const extension = imageFile.type === "image/jpeg"
      ? "jpg"
      : imageFile.type === "image/png"
        ? "png"
        : "webp";

    const filePath = `products/${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(filePath, imageFile, {
        cacheControl: "3600",
        contentType: imageFile.type,
        upsert: false,
      });

    if (error) {
      throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${error.message}`);
    }

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function saveProduct() {
    if (!supabase || loading) return;

    if (!productName.trim() || !category.trim()) {
      setMessage("กรุณากรอกชื่อสินค้าและหมวดหมู่");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      let imageUrl: string | null = currentImageUrl || null;

      if (imageFile) {
        imageUrl = await uploadProductImage();
      } else if (removeImage) {
        imageUrl = null;
      }

      const data = {
        name: productName.trim(),
        category: category.trim(),
        description: description.trim(),
        price_points: 0,
        image_url: imageUrl,
      };

      const result = editingId
        ? await supabase.from("products").update(data).eq("id", editingId)
        : await supabase.from("products").insert({ ...data, active: true });

      if (result.error) {
        setMessage(result.error.message);
        setLoading(false);
        return;
      }

      setMessage(editingId ? "แก้ไขสินค้าสำเร็จ" : "เพิ่มสินค้าสำเร็จ");
      clearProductForm();
      await loadProducts();
      await loadOverview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
    }

    setLoading(false);
  }

  function editProduct(product: Product) {
    setEditingId(product.id);
    setProductName(product.name);
    setCategory(product.category);
    setDescription(product.description || "");
    setCurrentImageUrl(product.image_url || "");
    setImageFile(null);
    setImagePreview("");
    setRemoveImage(false);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  async function loadStock() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("key_inventory")
      .select("id, product_id, duration, used")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setStock(data || []);
    setMessage("");
  }

  async function addKeys() {
    if (!supabase || loading) return;

    if (!stockProduct) {
      setMessage("กรุณาเลือกสินค้า");
      return;
    }

    const keys = [...new Set(
      keyText.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
    )];

    if (!keys.length) {
      setMessage("กรุณาวาง KEY อย่างน้อย 1 รายการ");
      return;
    }

    if (!window.confirm(`ยืนยันเพิ่ม KEY จำนวน ${keys.length} รายการใช่หรือไม่?`)) return;

    setLoading(true);
    setMessage("");

    const rows = keys.map((key) => ({
      product_id: stockProduct,
      duration: stockDuration,
      key_value: key,
      used: false,
    }));

    const { error } = await supabase.from("key_inventory").insert(rows);

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setKeyText("");
    setMessage(`เพิ่ม KEY สำเร็จ ${keys.length} รายการ`);
    await loadStock();
    await loadOverview();
  }

  async function loadPrices(productId: string, panel: string) {
    if (!supabase || !productId) return;

    const { data, error } = await supabase
      .from("product_panel_duration_prices")
      .select("duration, price_points")
      .eq("product_id", productId)
      .eq("panel_key", panel);

    if (error) {
      setMessage(error.message);
      return;
    }

    const next: Record<string, string> = {};
    durations.forEach((d) => (next[d] = ""));
    data?.forEach((item) => {
      next[item.duration] = String(item.price_points);
    });

    setPrices(next);
  }

  async function savePrices() {
    if (!supabase || !priceProduct || loading) return;

    const rows = [];

    for (const duration of durations) {
      const value = prices[duration];

      if (value === undefined || value.trim() === "") continue;

      const price = Number(value);

      if (!Number.isInteger(price) || price < 0) {
        setMessage("กรุณากรอกราคาเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป");
        return;
      }

      rows.push({
        product_id: priceProduct,
        panel_key: pricePanel,
        duration,
        price_points: price,
      });
    }

    if (!rows.length) {
      setMessage("กรุณากรอกราคาอย่างน้อย 1 ระยะเวลา");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("product_panel_duration_prices")
      .upsert(rows, {
        onConflict: "product_id,panel_key,duration",
      });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("บันทึกราคาสำเร็จ");
    await loadPrices(priceProduct, pricePanel);
  }

  async function loadSales() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("generated_keys")
      .select("id, product_name, duration, price_points, created_at, panel_key")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSales(data || []);
    setMessage("");
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const filteredMembers = members.filter((m) =>
    `${m.username || ""} ${m.id}`.toLowerCase().includes(search.toLowerCase())
  );

  function menuButton(id: Tab, label: string, icon: string) {
    return (
      <button
        key={id}
        onClick={() => {
          setTab(id);
          setMessage("");
        }}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "13px 14px",
          borderRadius: 9,
          border: tab === id ? "1px solid #dc2626" : "1px solid transparent",
          background: tab === id ? "#351313" : "transparent",
          color: tab === id ? "#ff7777" : "#ccc",
          cursor: "pointer",
          marginBottom: 5,
          fontWeight: 700,
        }}
      >
        <span style={{ marginRight: 10 }}>{icon}</span>
        {label}
      </button>
    );
  }

  if (checking) {
    return <main style={pageStyle}>กำลังตรวจสอบสิทธิ์ Admin...</main>;
  }

  if (!allowed) {
    return (
      <main style={pageStyle}>
        <h1 style={{ color: "#ff4545" }}>ACCESS DENIED</h1>
        <p>{message}</p>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={layoutStyle}>
        <aside style={sidebarStyle}>
          <h2 style={{ color: "#ef4444", margin: "5px 0" }}>DUDSHOP777</h2>
          <div style={{ color: "#777", fontSize: 11, marginBottom: 25 }}>
            ADMIN CONTROL PANEL
          </div>

          {menuButton("home", "ภาพรวมระบบ", "▦")}
          {menuButton("members", "จัดการสมาชิก", "♟")}
          {menuButton("products", "จัดการสินค้า", "▣")}
          {menuButton("stock", "คลัง KEY / เพิ่ม KEY", "🔑")}
          {menuButton("prices", "จัดการราคา", "฿")}
          {menuButton("sales", "ประวัติการขาย", "▤")}

          <div style={{ borderTop: "1px solid #333", marginTop: 20, paddingTop: 15 }}>
            <div style={{ color: "#aaa", fontSize: 12, marginBottom: 12 }}>
              ADMIN: {adminName}
            </div>
            <button onClick={logout} style={logoutStyle}>
              ออกจากระบบ
            </button>
          </div>
        </aside>

        <section style={{ minWidth: 0 }}>
          <header style={topbarStyle}>
            <div>
              <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 800 }}>
                DUDSHOP777 / ADMIN
              </div>
              <h1 style={{ margin: "5px 0", fontSize: 25 }}>
                {tab === "home" ? "ภาพรวมระบบ" :
                 tab === "members" ? "จัดการสมาชิก" :
                 tab === "products" ? "จัดการสินค้า" :
                 tab === "stock" ? "คลัง KEY" :
                 tab === "prices" ? "จัดการราคา" : "ประวัติการขาย"}
              </h1>
            </div>
            <span style={adminBadge}>ADMIN</span>
          </header>

          {message && (
            <div style={messageStyle}>{message}</div>
          )}

          {tab === "home" && (
            <>
              <div style={gridStyle}>
                <Stat title="สมาชิกทั้งหมด" value={stats.members} icon="👥" />
                <Stat title="สินค้าทั้งหมด" value={stats.products} icon="📦" />
                <Stat title="KEY คงเหลือ" value={stats.keys} icon="🔑" />
                <Stat title="KEY ที่สร้างแล้ว" value={stats.sold} icon="🛒" />
              </div>

              <div style={cardStyle}>
                <h3>ยินดีต้อนรับสู่ระบบหลังบ้าน</h3>
                <p style={muted}>เลือกฟังก์ชันจากเมนูด้านซ้ายเพื่อจัดการร้าน DUDSHOP777</p>
                <button style={buttonStyle} onClick={loadOverview}>
                  รีเฟรชข้อมูล
                </button>
              </div>
            </>
          )}

          {tab === "members" && (
            <>
              <input
                style={inputStyle}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อสมาชิกหรือ User ID"
              />

              {filteredMembers.map((member) => (
                <div key={member.id} style={cardStyle}>
                  <h3>{member.username || "ไม่มีชื่อสมาชิก"}</h3>
                  <p style={muted}>สิทธิ์: {member.role}</p>
                  <p>เครดิต: <b style={{ color: "#ff6464" }}>{member.points}</b></p>
                  <p>แผง: {member.assigned_panel === "reseller_300" ? "ตัวแทน 300" : member.assigned_panel === "reseller_1000" ? "ตัวแทน 1000" : "ยังไม่กำหนด"}</p>
                  <p style={smallText}>User ID: {member.id}</p>

                  {member.role === "member" && (
                    <>
                      <label>กำหนดแผงสมาชิก</label>
                      <select
                        style={inputStyle}
                        value={member.assigned_panel || ""}
                        disabled={loading}
                        onChange={(e) => changePanel(member.id, e.target.value)}
                      >
                        <option value="" disabled>เลือกแผงสมาชิก</option>
                        {panelOptions.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>

                      <label>เพิ่ม / ลดเครดิต</label>
                      <input
                        style={inputStyle}
                        type="number"
                        value={amounts[member.id] || ""}
                        onChange={(e) => setAmounts((old) => ({
                          ...old, [member.id]: e.target.value,
                        }))}
                        placeholder="เช่น 100 หรือ -50"
                      />
                      <button
                        style={buttonStyle}
                        disabled={loading}
                        onClick={() => adjustCredit(member.id)}
                      >
                        {loading ? "กำลังทำรายการ..." : "ยืนยันเพิ่ม / ลดเครดิต"}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </>
          )}

          {tab === "products" && (
            <>
              <div style={cardStyle}>
                <h3>{editingId ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</h3>

                <label>ชื่อสินค้า</label>
                <input
                  style={inputStyle}
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
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
                  style={{ ...inputStyle, minHeight: 85 }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="รายละเอียดสินค้า"
                />

                <label>รูปสินค้า (JPG / PNG / WebP ไม่เกิน 5 MB)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  style={{
                    ...inputStyle,
                    padding: 10,
                  }}
                />

                {(imagePreview || currentImageUrl) && (
                  <div style={{ marginBottom: 15 }}>
                    <p style={muted}>ตัวอย่างรูปสินค้า</p>
                    <img
                      src={imagePreview || currentImageUrl}
                      alt="ตัวอย่างรูปสินค้า"
                      style={{
                        width: "100%",
                        maxWidth: 280,
                        height: 190,
                        objectFit: "contain",
                        background: "#080808",
                        border: "1px solid #383838",
                        borderRadius: 10,
                      }}
                    />
                  </div>
                )}

                {(imagePreview || currentImageUrl) && (
                  <button
                    type="button"
                    style={{ ...cancelButton, margin: "0 0 15px" }}
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview("");
                      setCurrentImageUrl("");
                      setRemoveImage(true);
                    }}
                  >
                    ลบรูปสินค้า
                  </button>
                )}

                <button
                  style={buttonStyle}
                  disabled={loading}
                  onClick={saveProduct}
                >
                  {loading ? "กำลังบันทึก..." : editingId ? "บันทึกการแก้ไข" : "เพิ่มสินค้า"}
                </button>

                {editingId && (
                  <button
                    style={cancelButton}
                    disabled={loading}
                    onClick={clearProductForm}
                  >
                    ยกเลิก
                  </button>
                )}
              </div>

              <h3>รายการสินค้าทั้งหมด</h3>

              {products.map((product) => (
                <div key={product.id} style={cardStyle}>
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      style={{
                        width: "100%",
                        maxWidth: 220,
                        height: 150,
                        objectFit: "contain",
                        background: "#080808",
                        border: "1px solid #333",
                        borderRadius: 10,
                        marginBottom: 12,
                      }}
                    />
                  ) : (
                    <div style={noImageStyle}>
                      ยังไม่มีรูปสินค้า
                    </div>
                  )}

                  <h3>{product.name}</h3>
                  <p style={muted}>{product.category}</p>
                  <p>สถานะ: {product.active ? "กำลังขาย" : "ปิดการขาย"}</p>

                  <button
                    style={buttonStyle}
                    disabled={loading}
                    onClick={() => editProduct(product)}
                  >
                    แก้ไข
                  </button>

                  <button
                    style={product.active ? cancelButton : buttonStyle}
                    disabled={loading}
                    onClick={() => toggleProduct(product)}
                  >
                    {product.active ? "ปิดการขาย" : "เปิดการขาย"}
                  </button>
                </div>
              ))}
            </>
          )}

          {tab === "stock" && (
            <>
              <div style={cardStyle}>
                <h3>เพิ่ม KEY หลายรายการพร้อมกัน</h3>

                <label>เลือกสินค้า</label>
                <select style={inputStyle} value={stockProduct} onChange={(e) => setStockProduct(e.target.value)}>
                  <option value="">เลือกสินค้า</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>

                <label>เลือกระยะเวลา</label>
                <select style={inputStyle} value={stockDuration} onChange={(e) => setStockDuration(e.target.value)}>
                  {durations.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>

                <label>วาง KEY (หนึ่ง KEY ต่อหนึ่งบรรทัด)</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 180, fontFamily: "monospace" }}
                  value={keyText}
                  onChange={(e) => setKeyText(e.target.value)}
                  placeholder={"วาง KEY ที่นี่\nKEY-ตัวอย่าง-001\nKEY-ตัวอย่าง-002"}
                />

                <p style={muted}>
                  จำนวน KEY ที่จะเพิ่ม: {keyText.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).length} รายการ
                </p>

                <button style={buttonStyle} disabled={loading || !stockProduct} onClick={addKeys}>
                  {loading ? "กำลังเพิ่ม..." : "เพิ่ม KEY เข้าสต็อก"}
                </button>
              </div>

              <h3>สรุปสต็อกแยกตามระยะเวลา</h3>
              {products.filter((p) => p.id === stockProduct).map((product) => (
                <div key={product.id}>
                  <p>{product.name}</p>
                  {durations.map((d) => {
                    const items = stock.filter((s) => s.product_id === product.id && s.duration === d);
                    return (
                      <div key={d} style={miniCard}>
                        <b>{d}</b>
                        <span style={{ color: "#86efac" }}>คงเหลือ {items.filter((x) => !x.used).length}</span>
                        <span style={{ color: "#999" }}>ใช้แล้ว {items.filter((x) => x.used).length}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}

          {tab === "prices" && (
            <div style={cardStyle}>
              <h3>ตั้งราคาแยกแผง</h3>

              <label>เลือกสินค้า</label>
              <select style={inputStyle} value={priceProduct} onChange={(e) => setPriceProduct(e.target.value)}>
                <option value="">เลือกสินค้า</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              <label>เลือกแผง</label>
              <select style={inputStyle} value={pricePanel} onChange={(e) => setPricePanel(e.target.value)}>
                {panelOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>

              <h3>กำหนดราคาแต่ละระยะเวลา</h3>
              {durations.map((d) => (
                <div key={d}>
                  <label>{d}</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    style={inputStyle}
                    placeholder="กรอกราคาเครดิต"
                    value={prices[d] ?? ""}
                    onChange={(e) => setPrices((old) => ({ ...old, [d]: e.target.value }))}
                  />
                </div>
              ))}

              <button style={buttonStyle} disabled={loading || !priceProduct} onClick={savePrices}>
                {loading ? "กำลังบันทึก..." : "บันทึกราคา"}
              </button>
            </div>
          )}

          {tab === "sales" && (
            <>
              <div style={cardStyle}>
                <h3>ประวัติ KEY ที่สร้างล่าสุด</h3>
                <button style={buttonStyle} onClick={loadSales}>รีเฟรช</button>
              </div>

              {sales.map((sale) => (
                <div key={sale.id} style={cardStyle}>
                  <b>{sale.product_name}</b>
                  <p>ระยะเวลา: {sale.duration}</p>
                  <p>ราคา: {sale.price_points} เครดิต</p>
                  <p>แผง: {sale.panel_key === "reseller_300" ? "300" : sale.panel_key === "reseller_1000" ? "1000" : "-"}</p>
                  <p style={smallText}>{new Date(sale.created_at).toLocaleString("th-TH")}</p>
                </div>
              ))}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ title, value, icon }: { title: string; value: number; icon: string }) {
  return (
    <div style={statCard}>
      <div style={{ fontSize: 25 }}>{icon}</div>
      <p style={muted}>{title}</p>
      <strong style={{ fontSize: 28 }}>{value.toLocaleString("th-TH")}</strong>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#090909",
  color: "white",
  padding: 18,
  fontFamily: "Arial, sans-serif",
};

const layoutStyle: React.CSSProperties = {
  maxWidth: 1450,
  margin: "auto",
  display: "grid",
  gridTemplateColumns: "230px minmax(0, 1fr)",
  gap: 22,
};

const sidebarStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid #292929",
  borderRadius: 14,
  padding: 16,
  height: "fit-content",
  position: "sticky",
  top: 18,
};

const topbarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #292929",
  padding: "5px 0 20px",
  marginBottom: 22,
};

const adminBadge: React.CSSProperties = {
  background: "#351313",
  color: "#ff7777",
  border: "1px solid #7f1d1d",
  borderRadius: 20,
  padding: "7px 13px",
  fontSize: 12,
  fontWeight: 800,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 14,
};

const statCard: React.CSSProperties = {
  background: "#151515",
  border: "1px solid #303030",
  borderRadius: 12,
  padding: 18,
  marginBottom: 15,
};

const miniCard: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 10,
  background: "#151515",
  border: "1px solid #303030",
  borderRadius: 9,
  padding: 13,
  marginBottom: 8,
};

const muted: React.CSSProperties = {
  color: "#999",
  fontSize: 13,
};

const smallText: React.CSSProperties = {
  color: "#777",
  fontSize: 11,
  wordBreak: "break-all",
};

const messageStyle: React.CSSProperties = {
  background: "#291313",
  border: "1px solid #7f1d1d",
  color: "#ffaaaa",
  borderRadius: 9,
  padding: 12,
  marginBottom: 15,
};

const cancelButton: React.CSSProperties = {
  ...buttonStyle,
  background: "#333",
  marginLeft: 8,
};

const logoutStyle: React.CSSProperties = {
  ...buttonStyle,
  width: "100%",
  background: "#351313",
  border: "1px solid #7f1d1d",
};

const noImageStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 220,
  height: 150,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#080808",
  border: "1px dashed #444",
  borderRadius: 10,
  color: "#777",
  fontSize: 13,
  marginBottom: 12,
};
