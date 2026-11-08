
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
  image_url: string | null;
};

type Price = {
  duration: string;
  price_points: number;
};

type ProductOption = {
  prices: Price[];
  duration: string;
  quantity: number;
  stock: number;
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
  const [options, setOptions] = useState<Record<string, ProductOption>>({});
  const [purchasingId, setPurchasingId] = useState("");
  const [message, setMessage] = useState("");
  const [generatedKeys, setGeneratedKeys] = useState<GeneratedKey[]>([]);

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

  async function getStock(
    productId: string,
    duration: string,
    panel: PanelKey
  ): Promise<number> {
    if (!supabase) return 0;

    const { data, error } = await supabase.rpc("get_product_key_stock", {
      p_product_id: productId,
      p_duration: duration,
      p_panel_key: panel,
    });

    if (error) {
      throw new Error(error.message);
    }

    return Number(data ?? 0);
  }

  async function loadProducts(panel: PanelKey | null) {
    if (!supabase || !panel) return;

    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("id, name, description, image_url")
      .eq("active", true)
      .order("name");

    if (productError) {
      setMessage("โหลดสินค้าไม่สำเร็จ: " + productError.message);
      return;
    }

    const { data: priceData, error: priceError } = await supabase
      .from("product_panel_duration_prices")
      .select("product_id, duration, price_points")
      .eq("panel_key", panel);

    if (priceError) {
      setMessage("โหลดข้อมูลราคาไม่สำเร็จ: " + priceError.message);
      return;
    }

    const availableIds = new Set(
      (priceData || []).map((item) => item.product_id)
    );

    const filtered = (productData || []).filter((item) =>
      availableIds.has(item.id)
    );

    const newOptions: Record<string, ProductOption> = {};

    for (const product of filtered) {
      const productPrices = durations
        .map((duration) => {
          const found = (priceData || []).find(
            (item) =>
              item.product_id === product.id &&
              item.duration === duration
          );

          return found
            ? {
                duration: found.duration,
                price_points: Number(found.price_points),
              }
            : null;
        })
        .filter((item): item is Price => item !== null);

      if (productPrices.length > 0) {
        newOptions[product.id] = {
          prices: productPrices,
          duration: productPrices[0].duration,
          quantity: 1,
          stock: 0,
        };
      }
    }

    setProducts(filtered);
    setOptions(newOptions);

    if (filtered.length === 0) {
      setMessage("ยังไม่มีสินค้าเปิดขายในแผงนี้");
      return;
    }

    setMessage("");

    const stockResults = await Promise.all(
      filtered.map(async (product) => {
        const option = newOptions[product.id];

        if (!option) return [product.id, 0] as const;

        try {
          const stock = await getStock(
            product.id,
            option.duration,
            panel
          );

          return [product.id, stock] as const;
        } catch {
          return [product.id, 0] as const;
        }
      })
    );

    setOptions((current) => {
      const updated = { ...current };

      for (const [id, stock] of stockResults) {
        if (updated[id]) {
          updated[id] = { ...updated[id], stock };
        }
      }

      return updated;
    });
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

  function updateOption(
    productId: string,
    changes: Partial<ProductOption>
  ) {
    setOptions((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        ...changes,
      },
    }));
  }

  async function changeDuration(productId: string, newDuration: string) {
    if (!assignedPanel) return;

    updateOption(productId, {
      duration: newDuration,
      quantity: 1,
      stock: 0,
    });

    setGeneratedKeys([]);
    setMessage("");

    try {
      const stock = await getStock(
        productId,
        newDuration,
        assignedPanel
      );

      setOptions((current) => {
        const existing = current[productId];

        if (!existing || existing.duration !== newDuration) {
          return current;
        }

        return {
          ...current,
          [productId]: {
            ...existing,
            stock,
          },
        };
      });
    } catch (error) {
      setMessage(
        "โหลดสต็อกไม่สำเร็จ: " +
          (error instanceof Error ? error.message : "ไม่ทราบสาเหตุ")
      );
    }
  }

  async function purchase(product: Product) {
    if (!supabase || purchasingId) return;

    if (!assignedPanel) {
      setMessage("บัญชีนี้ยังไม่ได้รับการกำหนดแผง");
      return;
    }

    const option = options[product.id];

    if (!option) {
      setMessage("ไม่พบข้อมูลสินค้า");
      return;
    }

    const selectedPrice = option.prices.find(
      (item) => item.duration === option.duration
    );

    if (!selectedPrice) {
      setMessage("กรุณาเลือกสินค้าและระยะเวลา");
      return;
    }

    const quantity = option.quantity;
    const totalPrice = selectedPrice.price_points * quantity;

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      setMessage("จำนวน KEY ต้องอยู่ระหว่าง 1 ถึง 10");
      return;
    }

    if (quantity > option.stock) {
      setMessage("สต็อก KEY ไม่เพียงพอ");
      return;
    }

    if (points < totalPrice) {
      setMessage("เครดิตของคุณไม่เพียงพอ");
      return;
    }

    const confirmed = window.confirm(
      `ยืนยันการซื้อ ${product.name}\nจำนวน ${quantity} KEY\nราคา ${totalPrice.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} เครดิต ใช่หรือไม่?`
    );

    if (!confirmed) return;

    setPurchasingId(product.id);
    setMessage("");
    setGeneratedKeys([]);

    try {
      const { data, error } = await supabase.rpc(
        "generate_product_keys",
        {
          p_product_id: product.id,
          p_quantity: quantity,
          p_duration: option.duration,
          p_panel_key: assignedPanel,
        }
      );

      if (error) {
        setMessage("ซื้อไม่สำเร็จ: " + error.message);
        return;
      }

      if (!data || data.length === 0) {
        setMessage("ระบบไม่พบ KEY ที่สร้าง กรุณาติดต่อแอดมิน");
        return;
      }

      setGeneratedKeys(data);
      setMessage("ซื้อสำเร็จ!");

      await loadProfile();

      const newStock = await getStock(
        product.id,
        option.duration,
        assignedPanel
      );

      setOptions((current) => ({
        ...current,
        [product.id]: {
          ...current[product.id],
          stock: newStock,
          quantity: 1,
        },
      }));
    } catch (error) {
      setMessage(
        "เกิดข้อผิดพลาด: " +
          (error instanceof Error ? error.message : "ไม่ทราบสาเหตุ")
      );
    } finally {
      setPurchasingId("");
    }
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/");
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
          <strong>
            {points.toLocaleString("th-TH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} เครดิต
          </strong>
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

      {!assignedPanel ? (
        <div className="notice pageNotice">
          บัญชีนี้ยังไม่ได้รับการกำหนดแผง กรุณาติดต่อแอดมิน
        </div>
      ) : products.length === 0 ? (
        <div className="notice pageNotice">
          {message || "ยังไม่มีสินค้าเปิดขายในแผงนี้"}
        </div>
      ) : (
        <section className="productGrid">
          {products.map((product) => {
            const option = options[product.id];

            if (!option) return null;

            const selectedPrice = option.prices.find(
              (item) => item.duration === option.duration
            );

            const totalPrice = selectedPrice
              ? selectedPrice.price_points * option.quantity
              : 0;

            const isPurchasing = purchasingId === product.id;

            return (
              <article className="productCard" key={product.id}>
                {product.image_url ? (
                  <div className="productImageWrap">
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="productImage"
                    />
                  </div>
                ) : (
                  <div className="productImagePlaceholder">
                    ยังไม่มีรูปสินค้า
                  </div>
                )}

                <div className="productContent">
                  <h2>{product.name}</h2>

                  {product.description && (
                    <p className="description">{product.description}</p>
                  )}

                  <label>ระยะเวลาใช้งาน</label>
                  <div className="durationGrid">
                    {option.prices.map((item) => (
                      <button
                        type="button"
                        key={item.duration}
                        className={
                          option.duration === item.duration
                            ? "duration activeDuration"
                            : "duration"
                        }
                        onClick={() =>
                          changeDuration(product.id, item.duration)
                        }
                      >
                        <strong>{item.duration}</strong>
                        <span>
                          {item.price_points.toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} เครดิต
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="stockLine">
                    <span>สต็อกคงเหลือ</span>
                    <strong
                      className={
                        option.stock > 0 ? "stockAvailable" : "stockEmpty"
                      }
                    >
                      {option.stock} KEY
                    </strong>
                  </div>

                  <label>จำนวน KEY (1–10)</label>
                  <input
                    className="quantityInput"
                    type="number"
                    min="1"
                    max="10"
                    step="1"
                    value={option.quantity}
                    onChange={(e) => {
                      const value = e.target.value;
                      updateOption(product.id, {
                        quantity: value === "" ? 0 : Number(value),
                      });
                    }}
                  />

                  {selectedPrice && (
                    <div className="priceSummary">
                      <div>
                        <span>ราคาต่อ KEY</span>
                        <strong>
                          {selectedPrice.price_points.toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} เครดิต
                        </strong>
                      </div>
                      <div>
                        <span>จำนวน</span>
                        <strong>{option.quantity || 0} KEY</strong>
                      </div>
                      <div className="totalLine">
                        <span>ยอดชำระทั้งหมด</span>
                        <strong>
                          {totalPrice.toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} เครดิต
                        </strong>
                      </div>
                    </div>
                  )}

                  <button
                    className="buyButton"
                    onClick={() => purchase(product)}
                    disabled={
                      Boolean(purchasingId) ||
                      !selectedPrice ||
                      option.stock < 1 ||
                      !Number.isInteger(option.quantity) ||
                      option.quantity < 1 ||
                      option.quantity > 10 ||
                      option.quantity > option.stock
                    }
                  >
                    {isPurchasing
                      ? "กำลังดำเนินการ..."
                      : "BUY NOW — ซื้อสินค้า"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {message && (
        <div
          className={
            message === "ซื้อสำเร็จ!" || message === "คัดลอก KEY สำเร็จ"
              ? "successMessage pageNotice"
              : "notice pageNotice"
          }
        >
          {message}
        </div>
      )}

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
              <button onClick={() => copyKey(item.key_value)}>
                คัดลอก KEY
              </button>
            </div>
          ))}
        </section>
      )}

      <aside className="accountPanel">
        <div className="accountHeading">
          <span className="sideIcon">D</span>
          <div>
            <span className="eyebrow">YOUR ACCOUNT</span>
            <h2>ข้อมูลสมาชิก</h2>
          </div>
        </div>

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
          <strong>
            {points.toLocaleString("th-TH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </strong>
          <small>CREDITS</small>
        </div>
        <p className="sideNote">
          เครดิตจะถูกหักเมื่อการซื้อสำเร็จเท่านั้น
        </p>
      </aside>

      <footer>© 2026 DUDSHOP777 · ALL RIGHTS RESERVED</footer>

      <style jsx>{`
        .shopShell {
          min-height: 100vh;
          padding: 24px;
          color: #f5f5f5;
          background: radial-gradient(ellipse at 50% 0%, rgba(160,0,25,.16), transparent 48%), #09090b;
        }
        .topbar {
          max-width: 1180px; margin: 0 auto; padding: 16px 20px;
          display: flex; justify-content: space-between; align-items: center;
          gap: 16px; flex-wrap: wrap; background: #111114;
          border: 1px solid #29292e; border-radius: 14px;
        }
        .brand { color: white; font-size: 21px; font-weight: 900; text-decoration: none; letter-spacing: -1px; }
        .brand span { color: #ed1737; }
        .navLinks { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
        .navLinks a { color: #aaa; padding: 10px 12px; border-radius: 8px; font-size: 13px; text-decoration: none; }
        .navLinks a:hover, .navLinks .active { color: white; background: #351017; }
        .logoutBtn { background: #222226; color: white; border: 1px solid #3a3a40; border-radius: 8px; padding: 10px 13px; cursor: pointer; }
        .memberBar {
          max-width: 1180px; margin: 14px auto 0; display: flex;
          justify-content: flex-end; align-items: center; gap: 24px;
          padding: 12px 18px; background: #111114;
          border: 1px solid #29292e; border-radius: 12px;
        }
        .memberBar div { display: flex; flex-direction: column; gap: 4px; }
        .memberBar strong { font-size: 13px; }
        .muted { color: #888; font-size: 11px; }
        .creditBox strong { color: #ff405b; }
        .pageHeading { max-width: 1180px; margin: 54px auto 25px; }
        .eyebrow { color: #ed1737; font-size: 11px; font-weight: 900; letter-spacing: 2px; }
        .pageHeading h1 { margin: 10px 0; font-size: clamp(30px, 5vw, 48px); font-weight: 950; letter-spacing: -1.5px; }
        .pageHeading h1 span { color: #ed1737; }
        .pageHeading p { color: #999; margin: 0; }
        .panelBadge {
          max-width: 1180px; margin: 0 auto 20px; color: #ff6579;
          background: #210d12; border: 1px solid #5b1a27;
          display: inline-flex; align-items: center; gap: 9px;
          padding: 9px 13px; border-radius: 30px; font-size: 12px;
        }
        .liveDot { width: 7px; height: 7px; border-radius: 50%; background: #f32648; box-shadow: 0 0 10px #f32648; }
        .productGrid {
          max-width: 1180px; margin: 0 auto;
          display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 310px), 1fr));
          gap: 18px; align-items: start;
        }
        .productCard {
          overflow: hidden; background: #111114;
          border: 1px solid #2a2a30; border-radius: 16px;
        }
        .productImageWrap {
          width: 100%; height: 210px; display: flex; align-items: center;
          justify-content: center; overflow: hidden; background: #09090b;
          border-bottom: 1px solid #29292e;
        }
        .productImage { width: 100%; height: 100%; object-fit: contain; }
        .productImagePlaceholder {
          height: 180px; display: flex; align-items: center; justify-content: center;
          color: #777; background: #09090b; border-bottom: 1px dashed #444;
          font-size: 13px;
        }
        .productContent { padding: 20px; }
        .productContent h2 { margin: 0; font-size: 19px; }
        .description { color: #999; font-size: 13px; line-height: 1.6; }
        label { display: block; color: #ddd; font-size: 13px; font-weight: 700; margin: 19px 0 9px; }
        .durationGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .duration {
          color: #ccc; text-align: left; padding: 11px;
          background: #19191e; border: 1px solid #33333a;
          border-radius: 9px; cursor: pointer;
          display: flex; flex-direction: column; gap: 6px;
        }
        .duration strong { font-size: 12px; }
        .duration span { color: #888; font-size: 11px; }
        .activeDuration { border-color: #e51b3a; background: linear-gradient(145deg, #351018, #1b1014); color: white; }
        .activeDuration span { color: #ff8293; }
        .quantityInput {
          width: 100%; box-sizing: border-box; color: white;
          background: #1b1b20; border: 1px solid #393940;
          border-radius: 9px; padding: 13px; outline: none; font-size: 14px;
        }
        .quantityInput:focus { border-color: #ed1737; }
        .stockLine, .priceSummary > div {
          display: flex; justify-content: space-between; gap: 12px;
          padding: 12px 0; border-bottom: 1px solid #29292e; font-size: 13px;
        }
        .stockLine { margin-top: 12px; color: #999; }
        .stockAvailable { color: #48d597; }
        .stockEmpty { color: #ff405b; }
        .priceSummary { margin-top: 12px; padding: 12px 14px; background: #19191e; border: 1px solid #303037; border-radius: 12px; }
        .priceSummary span { color: #999; }
        .priceSummary strong { color: #eee; text-align: right; }
        .priceSummary .totalLine { border: 0; margin-top: 5px; padding-top: 14px; font-weight: 800; }
        .totalLine strong { color: #ff405b; font-size: 17px; }
        .buyButton {
          width: 100%; margin-top: 16px; padding: 15px; color: white;
          background: linear-gradient(100deg, #a90020, #ed1737); border: 0;
          border-radius: 10px; font-size: 14px; font-weight: 900; cursor: pointer;
        }
        .buyButton:hover:not(:disabled) { filter: brightness(1.15); }
        .buyButton:disabled { opacity: .4; cursor: not-allowed; }
        .accountPanel {
          max-width: 1132px; margin: 22px auto 0; padding: 22px;
          background: #111114; border: 1px solid #2a2a30; border-radius: 16px;
        }
        .accountHeading { display: flex; align-items: center; gap: 13px; margin-bottom: 15px; }
        .accountHeading h2 { margin: 5px 0 0; font-size: 18px; }
        .sideIcon { width: 42px; height: 42px; display: grid; place-items: center; background: #3a1019; color: #ff405b; border: 1px solid #712032; border-radius: 12px; font-weight: 950; font-size: 22px; }
        .accountRow { display: flex; justify-content: space-between; gap: 10px; padding: 12px 0; border-bottom: 1px solid #29292e; font-size: 12px; }
        .accountRow span { color: #888; }
        .accountCredit { margin-top: 18px; padding: 18px; background: #250e14; border: 1px solid #61202d; border-radius: 12px; display: flex; flex-direction: column; gap: 6px; }
        .accountCredit span { color: #c9a0a7; font-size: 12px; }
        .accountCredit strong { color: #ff405b; font-size: 27px; }
        .accountCredit small { color: #96636c; font-size: 9px; letter-spacing: 2px; }
        .sideNote { color: #777; font-size: 11px; line-height: 1.7; }
        .notice, .successMessage { padding: 13px; border-radius: 9px; font-size: 13px; line-height: 1.6; }
        .notice { color: #ff9aaa; background: #281117; border: 1px solid #652332; }
        .successMessage { color: #77e4ad; background: #10271c; border: 1px solid #236b43; }
        .pageNotice { max-width: 1154px; margin: 15px auto; }
        .resultPanel { max-width: 1132px; margin: 20px auto; background: #111114; border: 1px solid #2a2a30; border-radius: 16px; padding: 22px; }
        .sectionTitle { display: flex; gap: 13px; align-items: center; margin-bottom: 20px; }
        .number { color: #ff405b; font-size: 20px; font-weight: 900; background: #2a1016; border: 1px solid #5c1b28; border-radius: 10px; padding: 10px 12px; }
        .sectionTitle h2 { margin: 0; font-size: 19px; }
        .sectionTitle p { margin: 4px 0 0; color: #777; font-size: 10px; letter-spacing: 1.5px; }
        .keyCard { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 14px; padding: 15px; margin-top: 10px; background: #1a1a1f; border: 1px solid #35353c; border-left: 3px solid #ed1737; border-radius: 10px; }
        .keyCard > div { display: flex; flex-direction: column; gap: 5px; }
        .keyCard > div span { color: #888; font-size: 12px; }
        .keyCard code { color: #ff7185; overflow-wrap: anywhere; }
        .keyCard button { color: white; background: #a90020; border: 0; border-radius: 7px; padding: 10px 13px; cursor: pointer; }
        footer { max-width: 1180px; margin: 45px auto 0; padding: 20px 0; color: #555; border-top: 1px solid #252529; text-align: center; font-size: 11px; }
        @media (max-width: 760px) {
          .shopShell { padding: 12px; }
          .memberBar { justify-content: space-between; }
          .pageHeading { margin-top: 35px; }
          .navLinks { width: 100%; }
          .navLinks a { padding: 8px; }
          .keyCard { grid-template-columns: 1fr; }
          .accountPanel, .resultPanel { padding: 17px; }
        }
      `}</style>
    </main>
  );
}
