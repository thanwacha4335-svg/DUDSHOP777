"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function updatePassword() {
    if (!supabase) {
      setMessage("ไม่พบการตั้งค่า Supabase");
      return;
    }

    if (password.length < 8) {
      setMessage("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("เปลี่ยนรหัสผ่านสำเร็จแล้ว");

    setTimeout(() => {
      router.push("/");
    }, 1500);
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">DUDSHOP777</p>
        <h1>RESET <span>PASSWORD</span></h1>

        <div className="panel">
          <h2>ตั้งรหัสผ่านใหม่</h2>

          <label>รหัสผ่านใหม่</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="อย่างน้อย 8 ตัวอักษร"
          />

          <label>ยืนยันรหัสผ่านใหม่</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="กรอกรหัสผ่านอีกครั้ง"
          />

          <button onClick={updatePassword} disabled={loading}>
            {loading ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
          </button>

          {message && <p className="message">{message}</p>}
        </div>
      </section>
    </main>
  );
}
