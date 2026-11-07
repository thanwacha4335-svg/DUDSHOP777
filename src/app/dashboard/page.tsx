
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  category?: string;
  description?: string;
};

type Price = {
  duration: string;
  price_points: number;
};

type GeneratedKey = {
  id: string;
  product_name: string;
  key_value: string;
  created_at: string;
};

export default function Dashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("สมาชิก");
  const [points, setPoints] = useState(0);
  const [role, setRole] = useState("user");

  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [prices, setPrices] = useState<Price[]>([]);
  const [duration, setDuration] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [stock, setStock] = useState(0);

  const [purchasing, setPurchasing] = useState(false);
  const [message, setMessage] = useState("");
  const [generatedKeys, setGeneratedKeys] = useState<GeneratedKey[]>([]);

  const selectedPrice = prices.find(
    (item) => item.duration === duration
  );

  const totalPrice = selectedPrice
    ? selectedPrice.price_points * quantity
    : 0;

  async function loadProfile() {
    if (!supabase) return;

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      router.replace("/");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("username, role, points")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (data) {
      setUsername(data.username || auth.user.email || "สมาชิก");
      setPoints(Number(data.points || 0));
      setRole(data.role || "user");
    }
  }

  async function loadProducts() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("products")
      .select("id, name, category, description")
      .eq("active", true)
      .order("name");

    if (error) {
      setMessage("โหลดสินค้าไม่สำเร็จ: " + error.message);
      return;
    }

    setProducts(data || []);

    if (data?.length) {
      setProductId(data[0].id);
    }
  }

  async function loadPrices(id: string) {
    if (!supabase || !id) return;

    setPrices([]);
    setDuration("");
    setStock(0);

    const { data, error } = await supabase
      .from("product_duration_prices")
      .select("duration, price_points")
      .eq("product_id", id);

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
    }
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

      await loadProfile();
      await loadProducts();
      setLoading(false);
    }

    start();
  }, [router]);

  useEffect(() => {
    if (productId) {
      loadPrices(productId);
    }
  }, [productId]);

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

        <div className="panel">
          <h2>ข้อมูลสมาชิก</h2>
          <p>ชื่อสมาชิก: {username}</p>
          <p>
            เครดิตคงเหลือ: {points.toLocaleString("th-TH")}
          </p>
          <p>สถานะบัญชี: {role}</p>
        </div>

        <div className="panel">
          <h2>ร้านค้า DUDSHOP777</h2>

          {products.length === 0 ? (
            <p>ยังไม่มีสินค้าเปิดขายในขณะนี้</p>
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
                <p>
                  {products.find((p) => p.id === productId)?.description}
                </p>
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
                <p>สินค้านี้ยังไม่ได้กำหนดราคา</p>
              )}

              {selectedPrice && (
                <>
                  <p>
                    ราคาต่อคีย์:{" "}
                    {selectedPrice.price_points.toLocaleString("th-TH")} เครดิต
                  </p>
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

                  <h3>
                    รวมทั้งหมด: {totalPrice.toLocaleString("th-TH")} เครดิต
                  </h3>

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
              <div
                key={item.id}
                style={{
                  padding: 12,
                  marginBottom: 10,
                  background: "#211a30",
                  borderRadius: 8,
                  overflowWrap: "anywhere",
                }}
              >
                <p>{item.product_name}</p>
                <p>{duration}</p>
                <strong>{item.key_value}</strong>
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(item.key_value)
                  }
                >
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
