import React, { useEffect, useState } from 'react';
import { AlertTriangle, Mail, ShieldAlert } from 'lucide-react';

import axiosInstance from '@/lib/axios';
import { config } from '@/config/env';

export default function AccountSuspendedPage() {
  const [support, setSupport] = useState({
    title: 'Your account has been suspended',
    message:
      'Your access to Neura Note has been temporarily blocked by an administrator. If you believe this is an error, please contact support for assistance.',
    support_name: 'NeuroNote Support',
    contact_email: 'nihaajahamed@gmail.com',
  });

  useEffect(() => {
    let isMounted = true;

    axiosInstance
      .get(config.endpoints.suspendedInfo)
      .then(({ data }) => {
        if (!isMounted || !data) return;
        setSupport((prev) => ({
          title: data.title || prev.title,
          message: data.message || prev.message,
          support_name: data.support_name || prev.support_name,
          contact_email: data.contact_email || prev.contact_email,
        }));
      })
      .catch(() => {
        // Keep fallback content when endpoint is temporarily unavailable.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950 px-6 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-10 h-56 w-56 rounded-full bg-rose-500/20 blur-3xl" />
        <div className="absolute -right-16 bottom-10 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-2xl items-center">
        <div className="w-full rounded-3xl border border-white/10 bg-slate-900/80 p-7 text-slate-100 shadow-2xl backdrop-blur sm:p-10">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-400/10">
            <AlertTriangle className="h-8 w-8 text-rose-300" />
          </div>

          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-rose-200">
            Account status
          </div>

          <h1 className="text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            {support.title}
          </h1>

          <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">
            {support.message}
          </p>

          <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/90 p-4">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-300" />
              Support Contact
            </div>

           <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-4 py-3">
  <a
    href={`mailto:${support.contact_email}`}
    className="flex items-center gap-3 text-indigo-100 transition hover:underline"
  >
    <Mail className="h-5 w-5 text-indigo-200 shrink-0" />
    <div>
      <p className="text-xs text-indigo-300">Contact {support.support_name}</p>
      <p className="font-semibold">{support.contact_email}</p>
    </div>
  </a>

  <button
    type="button"
    onClick={() => navigator.clipboard.writeText(support.contact_email)}
    className="text-xs font-medium text-indigo-300 hover:text-white underline self-start sm:self-auto"
  >
    Copy Email
  </button>
</div>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = '/login';
            }}
            className="mt-6 w-full rounded-xl border border-rose-300/30 bg-rose-500/20 px-4 py-3 text-sm font-bold text-rose-100 transition hover:bg-rose-500/30"
          >
            Return to Login
          </button>
        </div>
      </div>
    </div>
  );
}
