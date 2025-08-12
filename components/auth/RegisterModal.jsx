// components/auth/RegisterModal.jsx
'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/common/Modal';
import Mailcheck from 'mailcheck';
import { DEFAULT_AVATAR_IDS } from "@/lib/constants";

export default function RegisterModal({ isOpen, onClose }) {
  const [internalOpen, setIsOpen] = useState(isOpen || false);
  const [email, setEmail] = useState('');
  const [backupEmail, setBackupEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [gender, setGender] = useState('hidden');

  const [agreeAge, setAgreeAge] = useState(false);
  const [agreePolicies, setAgreePolicies] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [domainSuggestion, setDomainSuggestion] = useState(null);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("openRegisterModal", handleOpen);
    return () => window.removeEventListener("openRegisterModal", handleOpen);
  }, []);

  const resetForm = () => {
    setEmail('');
    setBackupEmail('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setBirthYear('');
    setBirthMonth('');
    setBirthDay('');
    setGender('hidden');
    setAgreeAge(false);
    setAgreePolicies(false);
    setError('');
    setSuccess(false);
    setIsLoading(false);
  };

  function checkEmailSuggestion(email) {
    return new Promise((resolve) => {
      let resolved = false;
      Mailcheck.run({
        email,
        suggested: (suggestion) => {
          if (!resolved) {
            resolved = true;
            resolve(suggestion ? suggestion.full : null);
          }
        },
        empty: () => {
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        },
        domains: ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"]
      });
      setTimeout(() => resolve(null), 50);
    });
  }

  const handleRegister = async () => {
    setIsLoading(true);
    const trimmedEmail = email.trim();
    const trimmedBackupEmail = backupEmail.trim();

    const suggestion = await checkEmailSuggestion(trimmedEmail);
    if (suggestion) {
      setDomainSuggestion(suggestion);
      setIsLoading(false);
      return;
    }
    setDomainSuggestion(null);

    setError('');
    setSuccess(false);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Email 格式不正確');
      setIsLoading(false);
      return;
    }
    if (trimmedBackupEmail && !emailRegex.test(trimmedBackupEmail)) {
      setError('備用 Email 格式不正確');
      setIsLoading(false);
      return;
    }
    if (!username || username.trim().length < 2) {
      setError('請輸入使用者名稱（至少 2 個字）');
      setIsLoading(false);
      return;
    }
    if (password.length < 6) {
      setError('密碼至少 6 碼');
      setIsLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError('密碼與確認密碼不一致');
      setIsLoading(false);
      return;
    }

    const year = parseInt(birthYear);
    const month = parseInt(birthMonth);
    const day = parseInt(birthDay);
    const birthday = new Date(year, month - 1, day);
    const nowYear = new Date().getFullYear();
    if (
      !year || !month || !day ||
      isNaN(year) || isNaN(month) || isNaN(day) ||
      year < 1925 || year > nowYear ||
      month < 1 || month > 12 ||
      day < 1 || day > 31 ||
      birthday.getFullYear() !== year ||
      birthday.getMonth() !== month - 1 ||
      birthday.getDate() !== day
    ) {
      setError(`請輸入有效的生日（1925～${nowYear}）`);
      setIsLoading(false);
      return;
    }

    if (!agreeAge) {
      setError('請勾選「我已年滿 18 歲或已達當地法定年齡」。');
      setIsLoading(false);
      return;
    }
    if (!agreePolicies) {
      setError('請勾選「我已閱讀並同意平台條款/規範/免責」。');
      setIsLoading(false);
      return;
    }

    const selectedAvatar = DEFAULT_AVATAR_IDS[gender];

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          backupEmail: trimmedBackupEmail,
          username,
          password,
          gender,
          image: selectedAvatar,
          birthday: birthday.toISOString().split('T')[0],
          agreedAge: true,
          agreedPoliciesAt: new Date().toISOString(),
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || '註冊失敗');
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        resetForm();
        setIsOpen(false);
        onClose?.();
      }, 2000);
    } catch (err) {
      console.error('❌ 發生錯誤：', err);
      setError(err?.message || '系統錯誤，請稍後再試');
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    setDomainSuggestion(null);
    setIsOpen(false);
    onClose?.();
  };

  return (
    <Modal isOpen={internalOpen} onClose={handleClose} title="註冊帳號">
      {/* ⬇️ 固定往上推 80px */}
      <div className="overflow-y-auto pb-6 mb-[80px]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRegister();
          }}
          className="space-y-4"
        >
          {/* Email */}
          <div>
            <label className="text-sm text-white">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="請輸入 Email"
              className="w-full border border-zinc-700 px-3 py-2 rounded-md bg-zinc-800 text-white placeholder-gray-400"
            />
          </div>

          {/* 備用 Email */}
          <div>
            <label className="text-sm text-white">備用 Email（選填）</label>
            <input
              type="email"
              value={backupEmail}
              onChange={(e) => setBackupEmail(e.target.value)}
              placeholder="信箱失效時的備用信箱"
              className="w-full border border-zinc-700 px-3 py-2 rounded-md bg-zinc-800 text-white placeholder-gray-400"
            />
          </div>

          {/* 使用者名稱 */}
          <div>
            <label className="text-sm text-white">使用者名稱</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-zinc-700 px-3 py-2 rounded-md bg-zinc-800 text-white placeholder-gray-400"
            />
          </div>

          {/* 密碼 */}
          <div>
            <label className="text-sm text-white">密碼</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-zinc-700 px-3 py-2 rounded-md bg-zinc-800 text-white placeholder-gray-400"
            />
          </div>

          {/* 確認密碼 */}
          <div>
            <label className="text-sm text-white">確認密碼</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-zinc-700 px-3 py-2 rounded-md bg-zinc-800 text-white placeholder-gray-400"
            />
          </div>

          {/* 生日 */}
          <div>
            <label className="text-sm text-white">生日</label>
            <div className="flex gap-2 mt-1">
              <input
                type="number"
                placeholder="年 (如 2000)"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                className="w-1/3 px-3 py-2 rounded-md bg-zinc-800 text-white placeholder-gray-400"
              />
              <input
                type="number"
                placeholder="月"
                value={birthMonth}
                onChange={(e) => setBirthMonth(e.target.value)}
                className="w-1/4 px-3 py-2 rounded-md bg-zinc-800 text-white placeholder-gray-400"
              />
              <input
                type="number"
                placeholder="日"
                value={birthDay}
                onChange={(e) => setBirthDay(e.target.value)}
                className="w-1/4 px-3 py-2 rounded-md bg-zinc-800 text-white placeholder-gray-400"
              />
            </div>
          </div>

          {/* 性別 */}
          <div>
            <label className="text-sm text-white">性別</label>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setGender("male")}
                className={`px-3 py-1 rounded-full border ${gender === "male" ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-700"}`}
              >
                男性
              </button>
              <button
                type="button"
                onClick={() => setGender("female")}
                className={`px-3 py-1 rounded-full border ${gender === "female" ? "bg-pink-500 text-white" : "bg-gray-200 text-gray-700"}`}
              >
                女性
              </button>
              <button
                type="button"
                onClick={() => setGender("hidden")}
                className={`px-3 py-1 rounded-full border ${gender === "hidden" ? "bg-gray-600 text-white" : "bg-gray-200 text-gray-700"}`}
              >
                保密
              </button>
            </div>
          </div>

          {/* 條款必勾 */}
          <div className="space-y-2 border border-white/10 rounded-lg p-3 bg-zinc-900/40">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={agreeAge}
                onChange={(e) => setAgreeAge(e.target.checked)}
                className="mt-1"
              />
              <span>我已年滿 <b>18</b> 歲或已達當地法定年齡。</span>
            </label>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={agreePolicies}
                onChange={(e) => setAgreePolicies(e.target.checked)}
                className="mt-1"
              />
              <span>
                我已閱讀並同意
                <a href="/terms" className="text-blue-400 hover:underline mx-1" target="_blank" rel="noreferrer">服務條款</a>、
                <a href="/guidelines" className="text-blue-400 hover:underline mx-1" target="_blank" rel="noreferrer">社群規範</a>與
                <a href="/disclaimer" className="text-blue-400 hover:underline mx-1" target="_blank" rel="noreferrer">免責聲明</a>。
              </span>
            </label>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {domainSuggestion && (
            <p className="text-yellow-500 text-sm mt-2">
              ⚠️ 你是不是想輸入
              <span
                className="underline cursor-pointer text-blue-400 ml-1"
                onClick={() => {
                  setEmail(domainSuggestion);
                  setDomainSuggestion(null);
                  setError(null);
                }}
              >
                {domainSuggestion}
              </span>
              ？
            </p>
          )}

          {success && <p className="text-green-600 text-sm text-center">註冊成功！請至信箱完成驗證</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-all disabled:opacity-50"
          >
            {isLoading ? '註冊中…' : '註冊'}
          </button>
        </form>
      </div>
    </Modal>
  );
}
