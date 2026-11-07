
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
    <main className="shopShell">
      <nav className="topbar">
        <Link href="/dashboard" className="brand">
          <span>DUD</span>SHOP777
        </Link>

        <div className="navLinks">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/key-generator" className="active">Key Generator</Link>
          <Link href="/history">History</Link>
          <button onClick={logout} className="logoutBtn">ออกจากระบบ</button>
        </div>
      </nav>

      <div className="memberBar">
        <div>
          <span className="muted">สมาชิก</span>
          <strong>{username}</strong>
        </div>
        <div className="creditBox">
          <span className="muted">เครดิตคงเหลือ</span>
          <strong>{points.toLocaleString("th-TH")} เครดิต</strong>
        </div>
      </div>

      <section className="pageHeading">
        <span className="eyebrow">DUDSHOP777 STORE</span>
        <h1>KEY <span>GENERATOR</span></h1>
        <p>เลือกสินค้าและสร้าง KEY ได้ในที่เดียว</p>
      </section>

      <div className="panelBadge">
        <span className="liveDot" />
        {panelName}
      </div>

      <section className="purchaseLayout">
        <div className="purchasePanel">
          <div className="sectionTitle">
            <span className="number">01</span>
            <div>
              <h2>เลือกสินค้า</h2>
              <p>SELECT YOUR PRODUCT</p>
            </div>
          </div>

          {!assignedPanel ? (
            <div className="notice">บัญชีนี้ยังไม่ได้รับการกำหนดแผง กรุณาติดต่อแอดมิน</div>
          ) : products.length === 0 ? (
            <div className="notice">{message || "ยังไม่มีสินค้าเปิดขายในแผงนี้"}</div>
          ) : (
            <>
              <label>สินค้า</label>
              <div className="selectWrap">
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
              </div>

              {products.find((p) => p.id === productId)?.description && (
                <p className="description">
                  {products.find((p) => p.id === productId)?.description}
                </p>
              )}

              <label>ระยะเวลาใช้งาน</label>
              <div className="durationGrid">
                {prices.map((item) => (
                  <button
                    type="button"
                    key={item.duration}
                    className={duration === item.duration ? "duration activeDuration" : "duration"}
                    onClick={() => {
                      setDuration(item.duration);
                      setGeneratedKeys([]);
                      setMessage("");
                    }}
                  >
                    <strong>{item.duration}</strong>
                    <span>{item.price_points.toLocaleString("th-TH")} เครดิต</span>
                  </button>
                ))}
              </div>

              {prices.length === 0 && (
                <div className="notice">สินค้านี้ยังไม่ได้กำหนดราคาในแผงของคุณ</div>
              )}

              {selectedPrice && (
                <>
                  <label>จำนวน KEY</label>
                  <div className="selectWrap">
                    <select
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
                        .filter((n) => n <= stock)
                        .map((n) => (
                          <option key={n} value={n}>{n} KEY</option>
                        ))}
                    </select>
                  </div>

                  <div className="stockLine">
                    <span>สต็อกคงเหลือ</span>
                    <strong className={stock > 0 ? "stockAvailable" : "stockEmpty"}>
                      {stock} KEY
                    </strong>
                  </div>

                  <div className="priceSummary">
                    <div>
                      <span>ราคาต่อ KEY</span>
                      <strong>{selectedPrice.price_points.toLocaleString("th-TH")} เครดิต</strong>
                    </div>
                    <div>
                      <span>จำนวน</span>
                      <strong>{quantity} KEY</strong>
                    </div>
                    <div className="totalLine">
                      <span>ยอดชำระทั้งหมด</span>
                      <strong>{totalPrice.toLocaleString("th-TH")} เครดิต</strong>
                    </div>
                  </div>

                  <button
                    className="buyButton"
                    onClick={purchase}
                    disabled={purchasing || stock < 1 || quantity > stock}
                  >
                    {purchasing ? "กำลังดำเนินการ..." : "BUY NOW — ซื้อสินค้า"}
                  </button>
                </>
              )}
            </>
          )}

          {message && (
            <div className={message === "ซื้อสำเร็จ!" || message === "คัดลอก KEY สำเร็จ" ? "successMessage" : "notice"}>
              {message}
            </div>
          )}
        </div>

        <aside className="sidePanel">
          <div className="sideIcon">D</div>
          <span className="eyebrow">YOUR ACCOUNT</span>
          <h2>ข้อมูลสมาชิก</h2>
          <div className="accountRow">
            <span>ชื่อสมาชิก</span>
            <strong>{username}</strong>
          </div>
          <div className="accountRow">
            <span>แผงราคา</span>
            <strong>{panelName}</strong>
          </div>
          <div className="accountCredit">
            <span>เครดิตที่มี</span>
            <strong>{points.toLocaleString("th-TH")}</strong>
            <small>CREDITS</small>
          </div>
          <p className="sideNote">เครดิตจะถูกหักเมื่อการซื้อสำเร็จเท่านั้น</p>
        </aside>
      </section>

      {generatedKeys.length > 0 && (
        <section className="resultPanel">
          <div className="sectionTitle">
            <span className="number">02</span>
            <div>
              <h2>ซื้อสำเร็จแล้ว</h2>
              <p>YOUR GENERATED KEYS</p>
            </div>
          </div>

          {generatedKeys.map((item) => (
            <div key={item.id} className="keyCard">
              <div>
                <strong>{item.product_name}</strong>
                <span>{item.duration}</span>
              </div>
              <code>{item.key_value}</code>
              <button onClick={() => copyKey(item.key_value)}>คัดลอก KEY</button>
            </div>
          ))}
        </section>
      )}

      <footer>© 2026 DUDSHOP777 · ALL RIGHTS RESERVED</footer>

      <style jsx>{`
        .shopShell {
          min-height: 100vh;
          padding: 24px;
          color: #f5f5f5;
          background:
            radial-gradient(ellipse at 50% 0%, rgba(160, 0, 25, .16), transparent 48%),
            #09090b;
        }

        .topbar {
          max-width: 1180px;
          margin: 0 auto;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          background: #111114;
          border: 1px solid #29292e;
          border-radius: 14px;
        }

        .brand {
          color: white;
          font-size: 21px;
          font-weight: 900;
          text-decoration: none;
          letter-spacing: -1px;
        }

        .brand span { color: #ed1737; }

        .navLinks {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .navLinks a {
          color: #aaa;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 13px;
          text-decoration: none;
        }

        .navLinks a:hover, .navLinks .active {
          color: white;
          background: #351017;
        }

        .logoutBtn {
          background: #222226;
          color: white;
          border: 1px solid #3a3a40;
          border-radius: 8px;
          padding: 10px 13px;
          cursor: pointer;
        }

        .memberBar {
          max-width: 1180px;
          margin: 14px auto 0;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 24px;
          padding: 12px 18px;
          background: #111114;
          border: 1px solid #29292e;
          border-radius: 12px;
        }

        .memberBar div { display: flex; flex-direction: column; gap: 4px; }
        .memberBar strong { font-size: 13px; }
        .muted { color: #888; font-size: 11px; }
        .creditBox strong { color: #ff405b; }

        .pageHeading {
          max-width: 1180px;
          margin: 54px auto 25px;
        }

        .eyebrow {
          color: #ed1737;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .pageHeading h1 {
          margin: 10px 0;
          font-size: clamp(30px, 5vw, 48px);
          font-weight: 950;
          letter-spacing: -1.5px;
        }

        .pageHeading h1 span { color: #ed1737; }
        .pageHeading p { color: #999; margin: 0; }

        .panelBadge {
          max-width: 1180px;
          margin: 0 auto 18px;
          color: #ff6579;
          background: #210d12;
          border: 1px solid #5b1a27;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 9px 13px;
          border-radius: 30px;
          font-size: 12px;
        }

        .liveDot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #f32648;
          box-shadow: 0 0 10px #f32648;
        }

        .purchaseLayout {
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1.7fr) minmax(250px, .8fr);
          gap: 18px;
          align-items: start;
        }

        .purchasePanel, .sidePanel, .resultPanel {
          background: #111114;
          border: 1px solid #2a2a30;
          border-radius: 16px;
          padding: 24px;
        }

        .sectionTitle {
          display: flex;
          gap: 13px;
          align-items: center;
          margin-bottom: 25px;
        }

        .number {
          color: #ff405b;
          font-size: 20px;
          font-weight: 900;
          background: #2a1016;
          border: 1px solid #5c1b28;
          border-radius: 10px;
          padding: 10px 12px;
        }

        .sectionTitle h2, .sidePanel h2 { margin: 0; font-size: 19px; }
        .sectionTitle p { margin: 4px 0 0; color: #777; font-size: 10px; letter-spacing: 1.5px; }

        label {
          display: block;
          color: #ddd;
          font-size: 13px;
          font-weight: 700;
          margin: 20px 0 9px;
        }

        .selectWrap select {
          width: 100%;
          color: white;
          background: #1b1b20;
          border: 1px solid #393940;
          border-radius: 9px;
          padding: 14px;
          outline: none;
          font-size: 14px;
        }

        .selectWrap select:focus { border-color: #ed1737; }
        .selectWrap option { background: #1b1b20; }

        .description { color: #999; font-size: 13px; }

        .durationGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(125px, 1fr));
          gap: 9px;
        }

        .duration {
          color: #ccc;
          text-align: left;
          padding: 13px;
          background: #19191e;
          border: 1px solid #33333a;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .duration strong { font-size: 13px; }
        .duration span { color: #888; font-size: 11px; }

        .activeDuration {
          border-color: #e51b3a;
          background: linear-gradient(145deg, #351018, #1b1014);
          box-shadow: 0 0 0 1px rgba(237, 23, 55, .15);
          color: white;
        }

        .activeDuration span { color: #ff8293; }

        .stockLine, .priceSummary > div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #29292e;
          font-size: 13px;
        }

        .stockLine { margin-top: 14px; color: #999; }
        .stockAvailable { color: #48d597; }
        .stockEmpty { color: #ff405b; }

        .priceSummary {
          margin-top: 14px;
          padding: 12px 16px;
          background: #19191e;
          border: 1px solid #303037;
          border-radius: 12px;
        }

        .priceSummary span { color: #999; }
        .priceSummary strong { color: #eee; }

        .priceSummary .totalLine {
          border: 0;
          margin-top: 5px;
          padding-top: 16px;
          font-weight: 800;
        }

        .totalLine strong {
          color: #ff405b;
          font-size: 20px;
        }

        .buyButton {
          width: 100%;
          margin-top: 18px;
          padding: 16px;
          color: white;
          background: linear-gradient(100deg, #a90020, #ed1737);
          border: 0;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 7px 22px rgba(210, 0, 35, .18);
        }

        .buyButton:hover:not(:disabled) { filter: brightness(1.15); }
        .buyButton:disabled { opacity: .45; cursor: not-allowed; }

        .sidePanel { position: sticky; top: 18px; }
        .sideIcon {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          margin-bottom: 18px;
          background: #3a1019;
          color: #ff405b;
          border: 1px solid #712032;
          border-radius: 12px;
          font-weight: 950;
          font-size: 23px;
        }

        .sidePanel h2 { margin: 7px 0 20px; }
        .accountRow {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 0;
          border-bottom: 1px solid #29292e;
          font-size: 12px;
        }

        .accountRow span { color: #888; }
        .accountRow strong { text-align: right; }

        .accountCredit {
          margin-top: 18px;
          padding: 18px;
          background: #250e14;
          border: 1px solid #61202d;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .accountCredit span { color: #c9a0a7; font-size: 12px; }
        .accountCredit strong { color: #ff405b; font-size: 27px; }
        .accountCredit small { color: #96636c; font-size: 9px; letter-spacing: 2px; }

        .sideNote { color: #777; font-size: 11px; line-height: 1.7; }

        .notice, .successMessage {
          margin-top: 15px;
          padding: 13px;
          border-radius: 9px;
          font-size: 13px;
          line-height: 1.6;
        }

        .notice {
          color: #ff9aaa;
          background: #281117;
          border: 1px solid #652332;
        }

        .successMessage {
          color: #77e4ad;
          background: #10271c;
          border: 1px solid #236b43;
        }

        .resultPanel {
          max-width: 1180px;
          margin: 20px auto;
        }

        .keyCard {
          display: grid;
          grid-template-columns: 1fr auto auto;
          align-items: center;
          gap: 14px;
          padding: 15px;
          margin-top: 10px;
          background: #1a1a1f;
          border: 1px solid #35353c;
          border-left: 3px solid #ed1737;
          border-radius: 10px;
        }

        .keyCard > div { display: flex; flex-direction: column; gap: 5px; }
        .keyCard > div span { color: #888; font-size: 12px; }
        .keyCard code { color: #ff7185; overflow-wrap: anywhere; }

        .keyCard button {
          color: white;
          background: #a90020;
          border: 0;
          border-radius: 7px;
          padding: 10px 13px;
          cursor: pointer;
        }

        footer {
          max-width: 1180px;
          margin: 45px auto 0;
          padding: 20px 0;
          color: #555;
          border-top: 1px solid #252529;
          text-align: center;
          font-size: 11px;
        }

        @media (max-width: 760px) {
          .shopShell { padding: 12px; }
          .purchaseLayout { grid-template-columns: 1fr; }
          .sidePanel { position: static; }
          .memberBar { justify-content: space-between; }
          .pageHeading { margin-top: 35px; }
          .purchasePanel, .sidePanel, .resultPanel { padding: 17px; }
          .keyCard { grid-template-columns: 1fr; }
          .navLinks { width: 100%; }
          .navLinks a { padding: 8px; }
        }
      `}</style>
    </main>
  );
}
