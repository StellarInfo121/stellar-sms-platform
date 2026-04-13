const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Settings
export const getProvider = () => request('/settings/provider');
export const setProvider = (provider) =>
  request('/settings/provider', { method: 'POST', body: JSON.stringify({ provider }) });

// Contacts
export const getContacts = (search = '') =>
  request(`/contacts?search=${encodeURIComponent(search)}`);
export const createContact = (data) =>
  request('/contacts', { method: 'POST', body: JSON.stringify(data) });
export const updateContact = (id, data) =>
  request(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteContact = (id) =>
  request(`/contacts/${id}`, { method: 'DELETE' });
export const uploadContacts = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return fetch(`${BASE}/contacts/upload`, { method: 'POST', body: fd }).then(r => r.json());
};
export const getTags = () => request('/contacts/tags');

// Conversations
export const getConversations = () => request('/conversations');
export const getMessages = (convoId) => request(`/conversations/${convoId}/messages`);
export const sendSMS = (data) =>
  request('/sms/send', { method: 'POST', body: JSON.stringify(data) });

// Campaigns
export const getCampaigns = () => request('/campaigns');
export const getCampaign = (id) => request(`/campaigns/${id}`);
export const createCampaign = (data) =>
  request('/campaigns', { method: 'POST', body: JSON.stringify(data) });
export const sendCampaign = (id) =>
  request(`/campaigns/${id}/send`, { method: 'POST' });
export const getCampaignProgress = (id) => request(`/campaigns/${id}/progress`);

// Analytics
export const getAnalytics = () => request('/analytics');
