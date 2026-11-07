
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Stats = {
  members: number;
  products: number;
  keys: number;
  sold: number;
};

export default function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [stats, setStats] = useState<Stats>({
    members: 0,
    products: 0,
    keys: 0,
    sold: 0,
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    checkAdmin();
  }, []);

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
      setMessage("คุณไม่มีสิทธิ์เข้าถึง Admin Panel");
      setChecking(false);
      return;
    }

    setAdminName(profile.username || "Admin");
    setAllowed(true);
    await loadStats();
    setChecking(false);
  }

  async function loadStats() {
    if (!supabase) return;

    const [members, products, keys, sold] = await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "member"),

      supabase
        .from("products")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("key_inventory")
        .select("id", { count: "exact", head: true })
        .eq("used", false),

      supabase
        .from("generated_keys")
        .select("id", { count: "exact", head: true }),
    ]);

    setStats({
      members: members.count || 0,
      products: products.count || 0,
      keys: keys.count || 0,
      sold: sold.count || 0,
    });
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const menus = [
    {
      title: "จัดการสมาชิก",
      description: "ค้นหาสมาชิก เพิ่มเครดิต ลดเครดิต และกำหนดแผง",
      icon: "👥",
      href: "/admin/members",
    },
    {
      title: "จัดการสินค้า",
      description: "เพิ่มสินค้า แก้ไขสินค้า และเปิดปิดการขาย",
      icon: "📦",
      href: "/admin/products",
    },
    {
      title: "จัดการ KEY / สต็อก",
      description: "เพิ่ม KEY หลายชิ้นและจัดการคลังสินค้า",
      icon: "🔑",
      href: "/admin/stock",
    },
    {
      title: "จัดการราคา",
      description: "ตั้งราคาแยกแผงตัวแทน 300 และ 1000",
      icon: "🏷️",
      href: "/admin/prices",
    },
  ];

  if (checking) {
    return (
      <main style={pageStyle}>
        <div style={centerStyle}>กำลังตรวจสอบสิทธิ์ Admin...</div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main style={pageStyle}>
        <div style={centerStyle}>
          <h2 style={{ color: "#ff4545" }}>ACCESS DENIED</h2>
          <p>{message}</p>
          <Link href="/" style={linkStyle}>กลับหน้าหลัก</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1100, margin: "auto" }}>
        <header style={headerStyle}>
          <div>
            <div style={{ color: "#ff4545", fontWeight: 900, letterSpacing: 2 }}>
              DUDSHOP777
            </div>
            <h1 style={{ margin: "8px 0", fontSize: 30 }}>
              ADMIN PANEL
            </h1>
            <p style={{ color: "#999", margin: 0 }}>
              ยินดีต้อนรับ, {adminName}
            </p>
          </div>

          <button onClick={logout} style={logoutStyle}>
            ออกจากระบบ
          </button>
        </header>

        <h2 style={sectionTitle}>ภาพรวมระบบ</h2>

        <div style={statsGrid}>
          <Stat title="สมาชิกทั้งหมด" value={stats.members} icon="👥" />
          <Stat title="สินค้าทั้งหมด" value={stats.products} icon="📦" />
          <Stat title="KEY คงเหลือ" value={stats.keys} icon="🔑" />
          <Stat title="KEY ที่ขายแล้ว" value={stats.sold} icon="🛒" />
        </div>

        <h2 style={sectionTitle}>จัดการระบบหลังบ้าน</h2>

        <div style={menuGrid}>
          {menus.map((item) => (
            <Link href={item.href} key={item.href} style={menuLink}>
              <div style={{ fontSize: 34 }}>{item.icon}</div>
              <h3 style={{ margin: "12px 0 6px", color: "white" }}>
                {item.title}
              </h3>
              <p style={{ color: "#999", fontSize: 13, lineHeight: 1.6 }}>
                {item.description}
              </p>
              <div style={{ color: "#ff4545", marginTop: 12, fontWeight: 700 }}>
                เข้าจัดการ →
              </div>
            </Link>
          ))}
        </div>

        <div style={footerStyle}>
          DUDSHOP777 CONTROL CENTER
          <span style={{ color: "#777", display: "block", marginTop: 6 }}>
            ระบบจัดการสำหรับผู้ดูแลเท่านั้น
          </span>
        </div>
      </div>
    </main>
  );
}

function Stat({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: string;
}) {
  return (
    <div style={statCard}>
      <div style={{ fontSize: 25 }}>{icon}</div>
      <div style={{ color: "#999", fontSize: 13, marginTop: 12 }}>
        {title}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, marginTop: 5 }}>
        {value.toLocaleString("th-TH")}
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#090909",
  color: "white",
  padding: "32px 18px",
  fontFamily: "Arial, sans-serif",
};

const centerStyle = {
  maxWidth: 500,
  margin: "100px auto",
  textAlign: "center" as const,
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap" as const,
  borderBottom: "1px solid #292929",
  paddingBottom: 25,
};

const sectionTitle = {
  fontSize: 19,
  marginTop: 32,
  marginBottom: 16,
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 14,
};

const statCard = {
  background: "#151515",
  border: "1px solid #292929",
  borderRadius: 12,
  padding: 18,
};

const menuGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
};

const menuLink = {
  display: "block",
  textDecoration: "none",
  background: "#151515",
  border: "1px solid #333",
  borderRadius: 14,
  padding: 20,
  transition: "0.2s",
};

const logoutStyle = {
  background: "#241010",
  border: "1px solid #a52b2b",
  color: "#ff6666",
  borderRadius: 8,
  padding: "11px 16px",
  cursor: "pointer",
};

const linkStyle = {
  color: "#ff4545",
};

const footerStyle = {
  textAlign: "center" as const,
  color: "#ff4545",
  fontSize: 12,
  letterSpacing: 2,
  marginTop: 45,
  padding: 20,
  borderTop: "1px solid #292929",
};
