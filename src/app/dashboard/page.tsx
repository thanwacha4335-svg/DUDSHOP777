
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type PanelKey = "reseller_300" | "reseller_1000";

export default function Dashboard() {
  const router = useRouter();

  const [username, setUsername] = useState("สมาชิก");
  const [points, setPoints] = useState(0);
  const [role, setRole] = useState("member");
  const [assignedPanel, setAssignedPanel] = useState<PanelKey | null>(null);
  const [keysGenerated, setKeysGenerated] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const panelName =
    assignedPanel === "reseller_300"
      ? "แผงตัวแทน 300"
      : assignedPanel === "reseller_1000"
      ? "แผงตัวแทน 1000"
      : "ยังไม่ได้รับการกำหนดแผง";

  useEffect(() => {
    async function loadDashboard() {
      if (!supabase) {
        router.replace("/");
        return;
      }

      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        router.replace("/");
        return;
      }

      const userId = auth.user.id;

      const [profileResult, keysResult, ordersResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("username, role, points, assigned_panel")
            .eq("id", userId)
            .maybeSingle(),

          supabase
            .from("generated_keys")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId),

          supabase
            .from("credit_transactions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("transaction_type", "purchase")
            .eq("status", "approved"),
        ]);

      if (profileResult.error) {
        setMessage("โหลดข้อมูลสมาชิกไม่สำเร็จ: " + profileResult.error.message);
      } else if (profileResult.data) {
        const profile = profileResult.data;

        setUsername(profile.username || auth.user.email || "สมาชิก");
        setPoints(Number(profile.points || 0));
        setRole(profile.role || "member");

        const panel =
          profile.assigned_panel === "reseller_300" ||
          profile.assigned_panel === "reseller_1000"
            ? profile.assigned_panel
            : null;

        setAssignedPanel(panel);
      }

      if (!keysResult.error) {
        setKeysGenerated(keysResult.count || 0);
      }

      if (!ordersResult.error) {
        setTotalOrders(ordersResult.count || 0);
      }

      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/");
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
        <p className="eyebrow">MEMBER DASHBOARD</p>

        <h1>WELCOME <span>BACK</span></h1>

        <p className="sub">
          ยินดีต้อนรับ {username}
        </p>

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
          <p>
            แผงสมาชิก:{" "}
            <strong style={{ color: "#d69cff" }}>
              {panelName}
            </strong>
          </p>
        </div>

        {message && <div className="panel">{message}</div>}

        <div className="panel">
          <h2>เมนูร้านค้า</h2>
          <p>เลือกเมนูที่ต้องการใช้งาน</p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginTop: 16
          }}>
            <Link href="/key-generator" style={menuStyle}>
              <strong>KEY GENERATOR</strong>
              <p>เลือกสินค้าและสร้าง KEY</p>
            </Link>

            <Link href="/history" style={menuStyle}>
              <strong>PURCHASE HISTORY</strong>
              <p>ดูประวัติการซื้อและ KEY</p>
            </Link>
          </div>
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

const menuStyle = {
  display: "block",
  padding: 18,
  background: "linear-gradient(145deg, #21152f, #120f1b)",
  border: "1px solid #633b7c",
  borderRadius: 12,
  color: "white",
  textDecoration: "none",
};
