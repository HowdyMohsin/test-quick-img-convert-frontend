'use client';
import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { brand } from '@/lib/brand';
import { Button, Card, Input, Select, Textarea } from '@/components/ui';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('General question');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.trim().length < 10) {
      setError('Please fill in your name, a valid email, and a message of at least 10 characters.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/v1/contact', { method: 'POST', body: { name, email, topic, message, website: honeypot } });
      setSent(true);
    } catch (err: any) { setError(err?.message || 'Could not send your message.'); }
    finally { setLoading(false); }
  };
  return <div className="mx-auto max-w-2xl px-4 py-10">
    <h1 className="text-3xl font-extrabold text-ink">Contact us</h1>
    <p className="mt-2 text-muted">Questions, problems, or feedback — we read every message. You can also email us directly at <a className="font-semibold text-primary" href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>.</p>
    <Card className="mt-6 p-6">
      {sent ? (
        <div>
          <h2 className="text-lg font-bold text-ink">Message sent</h2>
          <p className="mt-2 text-sm text-muted">Thanks for getting in touch. We usually reply within one business day.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option>General question</option><option>Conversion problem</option><option>Payment or billing</option><option>Account help</option><option>Report abuse</option>
          </Select>
          <Textarea label="Message" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
          <input type="text" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
          <Button type="submit" loading={loading}>Send message</Button>
        </form>
      )}
    </Card>
  </div>;
}
