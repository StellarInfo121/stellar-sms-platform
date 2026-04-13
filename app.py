import os
import csv
import io
import re
import secrets
import threading
import time
from datetime import datetime, timezone, date, timedelta
from urllib.parse import urlencode

import requests as http_requests
from requests.auth import HTTPBasicAuth

from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory, Response, session, redirect
from flask_cors import CORS
from twilio.rest import Client as TwilioClient

from models import (db, Setting, User, Contact, ContactImport,
                     Conversation, ConversationEvent, Message, Template,
                     Campaign, BlastMessage, DailyMessageCount)

load_dotenv()

app = Flask(__name__, static_folder='frontend/dist', static_url_path='')
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-change-in-production')
db_url = os.getenv('DATABASE_URL', 'sqlite:///sms_platform.db')
if db_url == 'sqlite:///sms_platform.db' and os.path.exists('/tmp'):
    db_url = 'sqlite:////tmp/sms_platform.db'
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

CORS(app)
db.init_app(app)

TWILIO_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_PHONE = os.getenv('TWILIO_PHONE_NUMBER')

SW_PROJECT = os.getenv('SIGNALWIRE_PROJECT_ID')
SW_TOKEN = os.getenv('SIGNALWIRE_API_TOKEN')
SW_SPACE = os.getenv('SIGNALWIRE_SPACE_URL')
SW_PHONE = os.getenv('SIGNALWIRE_PHONE_NUMBER')

GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', 'placeholder')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', 'placeholder')
GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI',
    'http://localhost:5000/auth/google/callback')

tw_client = TwilioClient(TWILIO_SID, TWILIO_TOKEN)

SEED_USERS = [
    ('Moise Elinhorne', 'info@stellaradvancegroup.com', 'admin'),
    ('Rob Harper', None, 'user'),
    ('Matthew Walker', None, 'user'),
    ('Stanley Paul', None, 'user'),
    ('Eric Smith', None, 'user'),
    ('Jack Baker', None, 'user'),
    ('Joey Price', None, 'user'),
    ('Eli Coleman', None, 'user'),
    ('Alex Warren', None, 'user'),
    ('Mark Anderson', None, 'user'),
]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def get_current_user():
    uid = session.get('user_id')
    if not uid:
        return None
    return User.query.get(uid)


def normalize_phone(phone):
    digits = re.sub(r'[^\d+]', '', phone.strip())
    if digits and not digits.startswith('+'):
        if len(digits) == 10:
            digits = '+1' + digits
        elif len(digits) == 11 and digits.startswith('1'):
            digits = '+' + digits
    return digits


def get_active_provider():
    s = Setting.query.get('active_provider')
    return s.value if s else 'twilio'


def send_signalwire_sms(to, body, from_number):
    url = f"https://{SW_SPACE}/api/laml/2010-04-01/Accounts/{SW_PROJECT}/Messages.json"
    data = {"To": to, "From": from_number, "Body": body}
    auth = HTTPBasicAuth(SW_PROJECT, SW_TOKEN)
    response = http_requests.post(url, data=data, auth=auth)
    result = response.json()
    if response.status_code >= 400:
        code = result.get('code', response.status_code)
        message = result.get('message', 'Unknown SignalWire error')
        print(f"[SignalWire ERROR] code={code} to={to} message={message}")
        raise Exception(f"SignalWire error {code}: {message}")
    return result.get('sid', '')


def send_sms(to, body, provider=None):
    if provider is None:
        provider = get_active_provider()
    if provider == 'signalwire':
        sid = send_signalwire_sms(to, body, SW_PHONE)
    else:
        try:
            msg = tw_client.messages.create(to=to, from_=TWILIO_PHONE, body=body)
            sid = msg.sid
        except Exception as e:
            print(f"[Twilio ERROR] code={getattr(e, 'code', '')} to={to} error={e}")
            raise
    _increment_daily_count(provider)
    return sid, provider


def _increment_daily_count(provider):
    today = date.today()
    dc = DailyMessageCount.query.filter_by(date=today, provider=provider).first()
    if dc:
        dc.count += 1
    else:
        db.session.add(DailyMessageCount(date=today, provider=provider, count=1))


# ─── Auth middleware ─────────────────────────────────────────────────────────

@app.before_request
def require_auth():
    path = request.path
    if path.startswith('/auth/'):
        return
    if path.startswith('/api/sms/twilio/webhook'):
        return
    if path.startswith('/api/sms/signalwire/webhook'):
        return
    if path.startswith('/api/sms/status'):
        return
    if not path.startswith('/api/'):
        return
    if path == '/api/auth/me':
        return
    if 'user_id' not in session:
        return jsonify({'error': 'Authentication required'}), 401


# ─── Google OAuth ────────────────────────────────────────────────────────────

@app.route('/auth/google')
def google_login():
    state = secrets.token_urlsafe(32)
    session['oauth_state'] = state
    params = {
        'client_id': GOOGLE_CLIENT_ID,
        'redirect_uri': GOOGLE_REDIRECT_URI,
        'response_type': 'code',
        'scope': 'openid email profile',
        'state': state,
        'access_type': 'offline',
        'prompt': 'select_account',
    }
    return redirect(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}")


@app.route('/auth/google/callback')
def google_callback():
    if request.args.get('error'):
        return redirect('/?auth_error=cancelled')

    if request.args.get('state') != session.pop('oauth_state', None):
        return redirect('/?auth_error=invalid_state')

    code = request.args.get('code')
    if not code:
        return redirect('/?auth_error=no_code')

    token_resp = http_requests.post('https://oauth2.googleapis.com/token', data={
        'code': code,
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'redirect_uri': GOOGLE_REDIRECT_URI,
        'grant_type': 'authorization_code',
    })
    if token_resp.status_code != 200:
        return redirect('/?auth_error=token_failed')

    token_data = token_resp.json()
    userinfo_resp = http_requests.get(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        headers={'Authorization': f'Bearer {token_data["access_token"]}'}
    )
    if userinfo_resp.status_code != 200:
        return redirect('/?auth_error=userinfo_failed')

    userinfo = userinfo_resp.json()
    email = userinfo.get('email', '').lower().strip()

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if not user:
        return redirect('/?auth_error=access_denied')

    user.avatar_url = userinfo.get('picture', '')
    user.last_login = datetime.now(timezone.utc)
    if userinfo.get('name') and not user.name:
        user.name = userinfo['name']
    db.session.commit()

    session.permanent = True
    session['user_id'] = user.id
    return redirect('/')


@app.route('/auth/dev-login/<int:user_id>')
def dev_login(user_id):
    if GOOGLE_CLIENT_ID != 'placeholder':
        return jsonify({'error': 'Dev login disabled'}), 403
    user = User.query.get_or_404(user_id)
    session.permanent = True
    session['user_id'] = user.id
    user.last_login = datetime.now(timezone.utc)
    db.session.commit()
    return redirect('/')


@app.route('/auth/logout')
def logout():
    session.clear()
    return redirect('/')


@app.route('/api/auth/me')
def auth_me():
    user = get_current_user()
    if not user:
        return jsonify({'authenticated': False}), 401
    return jsonify({**user.to_dict(), 'authenticated': True})


# ─── Settings ────────────────────────────────────────────────────────────────

@app.route('/api/settings/provider', methods=['GET'])
def get_provider():
    return jsonify({'provider': get_active_provider()})


@app.route('/api/settings/provider', methods=['POST'])
def set_provider():
    data = request.json
    provider = data.get('provider', 'twilio')
    s = Setting.query.get('active_provider')
    if s:
        s.value = provider
    else:
        db.session.add(Setting(key='active_provider', value=provider))
    db.session.commit()
    return jsonify({'provider': provider})


# ─── Users (replaces team-members) ──────────────────────────────────────────

@app.route('/api/users', methods=['GET'])
def list_users():
    users = User.query.order_by(User.name).all()
    return jsonify([u.to_dict() for u in users])


@app.route('/api/users', methods=['POST'])
def create_user():
    current = get_current_user()
    if not current or current.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403
    data = request.json
    email = data.get('email', '').lower().strip() or None
    if email:
        existing = User.query.filter(db.func.lower(User.email) == email).first()
        if existing:
            return jsonify({'error': 'Email already exists'}), 400
    u = User(name=data['name'], email=email, role=data.get('role', 'user'))
    db.session.add(u)
    db.session.commit()
    return jsonify(u.to_dict()), 201


@app.route('/api/users/<int:uid>', methods=['PUT'])
def update_user(uid):
    current = get_current_user()
    if not current or current.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403
    u = User.query.get_or_404(uid)
    data = request.json
    if 'name' in data:
        u.name = data['name']
    if 'email' in data:
        email = data['email'].lower().strip() if data['email'] else None
        if email:
            dup = User.query.filter(db.func.lower(User.email) == email, User.id != uid).first()
            if dup:
                return jsonify({'error': 'Email already exists'}), 400
        u.email = email
    if 'role' in data:
        u.role = data['role']
    db.session.commit()
    return jsonify(u.to_dict())


@app.route('/api/users/<int:uid>', methods=['DELETE'])
def delete_user(uid):
    current = get_current_user()
    if not current or current.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403
    u = User.query.get_or_404(uid)
    db.session.delete(u)
    db.session.commit()
    return jsonify({'ok': True})


# backward compat alias
@app.route('/api/team-members', methods=['GET'])
def list_team_members():
    return list_users()


# ─── Daily Count ─────────────────────────────────────────────────────────────

@app.route('/api/daily-count', methods=['GET'])
def daily_count():
    today = date.today()
    counts = DailyMessageCount.query.filter_by(date=today).all()
    total = sum(c.count for c in counts)
    return jsonify({'date': today.isoformat(), 'count': total, 'limit': 4000})


# ─── Contacts ────────────────────────────────────────────────────────────────

@app.route('/api/contacts', methods=['GET'])
def list_contacts():
    q = request.args.get('search', '')
    group = request.args.get('group', '')
    tag = request.args.get('tag', '')
    query = Contact.query

    if group == 'opted_out':
        query = query.filter(Contact.opted_out == True)
    elif group == 'blocked':
        query = query.filter(Contact.blocked == True)
    elif group == 'invalid':
        query = query.filter(Contact.invalid == True)
    elif group == 'never_messaged':
        messaged_phones = db.session.query(Conversation.phone).distinct()
        query = query.filter(~Contact.phone.in_(messaged_phones))

    if tag:
        query = query.filter(Contact.tags.ilike(f'%{tag}%'))
    if q:
        like = f'%{q}%'
        query = query.filter(
            db.or_(Contact.name.ilike(like), Contact.phone.ilike(like),
                   Contact.business.ilike(like), Contact.tags.ilike(like),
                   Contact.email.ilike(like))
        )
    contacts = query.order_by(Contact.created_at.desc()).all()
    return jsonify([c.to_dict() for c in contacts])


@app.route('/api/contacts/groups', methods=['GET'])
def contact_groups():
    messaged_phones = db.session.query(Conversation.phone).distinct()
    return jsonify({
        'all': Contact.query.count(),
        'opted_out': Contact.query.filter_by(opted_out=True).count(),
        'blocked': Contact.query.filter_by(blocked=True).count(),
        'invalid': Contact.query.filter_by(invalid=True).count(),
        'never_messaged': Contact.query.filter(~Contact.phone.in_(messaged_phones)).count(),
    })


@app.route('/api/contacts', methods=['POST'])
def create_contact():
    data = request.json
    tags = ','.join(data.get('tags', [])) if isinstance(data.get('tags'), list) else data.get('tags', '')
    phone = normalize_phone(data['phone'])
    name = data.get('name', '')
    if not name:
        name = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
    c = Contact(
        name=name, first_name=data.get('first_name', ''),
        last_name=data.get('last_name', ''), phone=phone,
        email=data.get('email', ''), business=data.get('business', ''), tags=tags,
    )
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201


@app.route('/api/contacts/<int:cid>', methods=['PUT'])
def update_contact(cid):
    c = Contact.query.get_or_404(cid)
    data = request.json
    if 'name' in data: c.name = data['name']
    if 'first_name' in data: c.first_name = data['first_name']
    if 'last_name' in data: c.last_name = data['last_name']
    if 'phone' in data: c.phone = normalize_phone(data['phone'])
    if 'email' in data: c.email = data['email']
    if 'business' in data: c.business = data['business']
    if 'tags' in data:
        c.tags = ','.join(data['tags']) if isinstance(data['tags'], list) else data['tags']
    if 'opted_out' in data: c.opted_out = data['opted_out']
    if 'blocked' in data: c.blocked = data['blocked']
    if 'invalid' in data: c.invalid = data['invalid']
    db.session.commit()
    return jsonify(c.to_dict())


@app.route('/api/contacts/<int:cid>', methods=['DELETE'])
def delete_contact(cid):
    c = Contact.query.get_or_404(cid)
    db.session.delete(c)
    db.session.commit()
    return jsonify({'ok': True})


@app.route('/api/contacts/upload', methods=['POST'])
def upload_contacts():
    file = request.files.get('file')
    mapping = request.form.get('mapping', '')
    if not file:
        return jsonify({'error': 'No file'}), 400

    stream = io.StringIO(file.stream.read().decode('utf-8-sig'))
    reader = csv.DictReader(stream)
    rows = list(reader)
    col_map = {}
    if mapping:
        import json
        col_map = json.loads(mapping)

    created, skipped, duplicates = 0, 0, 0
    for row in rows:
        def get_mapped(field):
            csv_col = col_map.get(field, field)
            return row.get(csv_col, '').strip()

        phone = normalize_phone(get_mapped('phone') or get_mapped('number') or row.get('phone', '') or row.get('Phone', '') or row.get('Number', '') or row.get('number', ''))
        if not phone:
            skipped += 1
            continue
        existing = Contact.query.filter_by(phone=phone).first()
        if existing:
            duplicates += 1
            continue
        first = get_mapped('first_name') or row.get('first_name', '') or row.get('First Name', '') or ''
        last = get_mapped('last_name') or row.get('last_name', '') or row.get('Last Name', '') or ''
        name = get_mapped('name') or row.get('name', '') or row.get('Name', '') or f"{first} {last}".strip()
        c = Contact(
            name=name, first_name=first, last_name=last, phone=phone,
            email=get_mapped('email') or row.get('email', '') or row.get('Email', '') or '',
            business=get_mapped('business') or row.get('business', '') or row.get('Business', '') or '',
            tags=get_mapped('tags') or row.get('tags', '') or row.get('tag', '') or row.get('Tags', '') or '',
        )
        db.session.add(c)
        created += 1

    db.session.commit()
    ci = ContactImport(
        filename=file.filename or 'upload.csv', total_rows=len(rows),
        created_count=created, skipped_count=skipped, duplicate_count=duplicates,
    )
    db.session.add(ci)
    db.session.commit()
    return jsonify({'created': created, 'skipped': skipped, 'duplicates': duplicates})


@app.route('/api/contacts/preview-csv', methods=['POST'])
def preview_csv():
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file'}), 400
    stream = io.StringIO(file.stream.read().decode('utf-8-sig'))
    reader = csv.DictReader(stream)
    rows = []
    columns = reader.fieldnames or []
    for i, row in enumerate(reader):
        if i >= 5:
            break
        rows.append(row)
    return jsonify({'columns': columns, 'rows': rows})


@app.route('/api/contacts/tags', methods=['GET'])
def list_tags():
    contacts = Contact.query.all()
    tag_set = set()
    for c in contacts:
        if c.tags:
            for t in c.tags.split(','):
                t = t.strip()
                if t:
                    tag_set.add(t)
    return jsonify(sorted(tag_set))


@app.route('/api/contacts/imports', methods=['GET'])
def list_imports():
    imports = ContactImport.query.order_by(ContactImport.created_at.desc()).all()
    return jsonify([ci.to_dict() for ci in imports])


@app.route('/api/contacts/export', methods=['GET'])
def export_contacts():
    group = request.args.get('group', '')
    tag = request.args.get('tag', '')
    query = Contact.query
    if group == 'opted_out': query = query.filter(Contact.opted_out == True)
    elif group == 'blocked': query = query.filter(Contact.blocked == True)
    elif group == 'invalid': query = query.filter(Contact.invalid == True)
    if tag: query = query.filter(Contact.tags.ilike(f'%{tag}%'))
    contacts = query.order_by(Contact.name).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Name', 'First Name', 'Last Name', 'Phone', 'Email', 'Business', 'Tags', 'Opted Out'])
    for c in contacts:
        writer.writerow([c.name, c.first_name, c.last_name, c.phone, c.email, c.business, c.tags, c.opted_out])
    return Response(output.getvalue(), mimetype='text/csv',
                    headers={'Content-Disposition': 'attachment; filename=contacts.csv'})


# ─── Conversations ───────────────────────────────────────────────────────────

@app.route('/api/conversations', methods=['GET'])
def list_conversations():
    filt = request.args.get('filter', '')
    assigned = request.args.get('assigned_to', '')
    query = Conversation.query

    if filt == 'starred':
        query = query.filter(Conversation.starred == True)
    elif filt == 'closed':
        query = query.filter(Conversation.status == 'closed')
    elif filt == 'open':
        query = query.filter(Conversation.status == 'open')
    elif filt == 'assigned':
        if assigned:
            query = query.filter(Conversation.assigned_to == int(assigned))
        else:
            query = query.filter(Conversation.assigned_to.isnot(None))

    convos = query.order_by(Conversation.last_message_at.desc()).all()
    return jsonify([c.to_dict() for c in convos])


@app.route('/api/conversations/<int:cid>/messages', methods=['GET'])
def get_messages(cid):
    Conversation.query.get_or_404(cid)
    msgs = Message.query.filter_by(conversation_id=cid).order_by(Message.created_at.asc()).all()
    events = ConversationEvent.query.filter_by(conversation_id=cid).all()
    result = [m.to_dict() for m in msgs]
    for e in events:
        result.append({**e.to_dict(), 'type': 'event'})
    result.sort(key=lambda x: x.get('created_at', ''))
    return jsonify(result)


@app.route('/api/conversations/<int:cid>/assign', methods=['POST'])
def assign_conversation(cid):
    convo = Conversation.query.get_or_404(cid)
    data = request.json
    member_id = data.get('assigned_to')
    current = get_current_user()
    assigned_by = current.name if current else 'System'

    convo.assigned_to = member_id
    member = User.query.get(member_id) if member_id else None
    name = member.name if member else 'Unassigned'

    event = ConversationEvent(
        conversation_id=cid, event_type='assigned',
        details=f'{assigned_by} assigned this conversation to {name}',
        created_by=assigned_by,
    )
    db.session.add(event)
    db.session.commit()
    return jsonify(convo.to_dict())


@app.route('/api/conversations/<int:cid>/star', methods=['POST'])
def star_conversation(cid):
    convo = Conversation.query.get_or_404(cid)
    convo.starred = not convo.starred
    db.session.commit()
    return jsonify(convo.to_dict())


@app.route('/api/conversations/<int:cid>/status', methods=['POST'])
def set_conversation_status(cid):
    convo = Conversation.query.get_or_404(cid)
    data = request.json
    convo.status = data.get('status', 'open')
    db.session.commit()
    return jsonify(convo.to_dict())


# ─── Messages & Notes ────────────────────────────────────────────────────────

@app.route('/api/sms/send', methods=['POST'])
def send_single_sms():
    data = request.json
    to = normalize_phone(data['to'])
    body = data['body']
    provider = data.get('provider')
    current = get_current_user()

    try:
        sid, used_provider = send_sms(to, body, provider)
    except Exception as e:
        error_msg = str(e)
        print(f"[SMS SEND ERROR] provider={provider} to={to} error={error_msg}")
        return jsonify({'error': error_msg}), 400

    convo = Conversation.query.filter_by(phone=to).first()
    if not convo:
        contact = Contact.query.filter_by(phone=to).first()
        convo = Conversation(phone=to, contact_name=contact.name if contact else to)
        db.session.add(convo)
        db.session.flush()

    msg = Message(
        conversation_id=convo.id, direction='outbound',
        body=body, provider=used_provider, status='sent', sid=sid,
        sender_name=current.name if current else '',
        sender_id=current.id if current else None,
    )
    db.session.add(msg)
    convo.last_message = body
    convo.last_message_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(msg.to_dict()), 201


@app.route('/api/conversations/<int:cid>/notes', methods=['POST'])
def add_note(cid):
    Conversation.query.get_or_404(cid)
    data = request.json
    current = get_current_user()
    msg = Message(
        conversation_id=cid, direction='internal', body=data['body'],
        is_note=True,
        sender_name=current.name if current else data.get('sender_name', ''),
        sender_id=current.id if current else None,
        status='note',
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify(msg.to_dict()), 201


# ─── Webhooks (no auth required) ────────────────────────────────────────────

@app.route('/api/sms/twilio/webhook', methods=['POST'])
def twilio_webhook():
    from_ = request.form.get('From', '')
    body = request.form.get('Body', '')
    sid = request.form.get('MessageSid', '')
    _handle_inbound(from_, body, sid, 'twilio')
    return '<Response></Response>', 200, {'Content-Type': 'text/xml'}


@app.route('/api/sms/signalwire/webhook', methods=['POST'])
def signalwire_webhook():
    from_ = request.form.get('From', '')
    body = request.form.get('Body', '')
    sid = request.form.get('MessageSid', '')
    _handle_inbound(from_, body, sid, 'signalwire')
    return '<Response></Response>', 200, {'Content-Type': 'text/xml'}


def _handle_inbound(from_, body, sid, provider):
    if body.strip().upper() == 'STOP':
        contact = Contact.query.filter_by(phone=from_).first()
        if contact:
            contact.opted_out = True

    convo = Conversation.query.filter_by(phone=from_).first()
    if not convo:
        contact = Contact.query.filter_by(phone=from_).first()
        convo = Conversation(phone=from_, contact_name=contact.name if contact else from_)
        db.session.add(convo)
        db.session.flush()

    msg = Message(
        conversation_id=convo.id, direction='inbound',
        body=body, provider=provider, status='received', sid=sid,
    )
    db.session.add(msg)
    convo.last_message = body
    convo.last_message_at = datetime.now(timezone.utc)
    _increment_daily_count(provider)
    db.session.commit()


@app.route('/api/sms/status', methods=['POST'])
def sms_status_callback():
    sid = request.form.get('MessageSid', '')
    status = request.form.get('MessageStatus', '')
    if sid and status:
        msg = Message.query.filter_by(sid=sid).first()
        if msg:
            msg.status = status
            db.session.commit()
        bm = BlastMessage.query.filter_by(sid=sid).first()
        if bm:
            bm.status = status
            now = datetime.now(timezone.utc)
            campaign = Campaign.query.get(bm.campaign_id)
            if status == 'delivered':
                bm.delivered_at = now
                if campaign: campaign.delivered_count += 1
            elif status in ('failed', 'undelivered'):
                if campaign: campaign.failed_count += 1
            db.session.commit()
    return '', 204


# ─── Templates ───────────────────────────────────────────────────────────────

@app.route('/api/templates', methods=['GET'])
def list_templates():
    q = request.args.get('search', '')
    owner_filter = request.args.get('owner', '')
    current = get_current_user()
    query = Template.query
    if q:
        like = f'%{q}%'
        query = query.filter(db.or_(Template.title.ilike(like), Template.body.ilike(like)))
    if owner_filter == 'mine' and current:
        query = query.filter(Template.owner_id == current.id)
    else:
        if current:
            query = query.filter(db.or_(Template.shared == True, Template.owner_id == current.id))
        else:
            query = query.filter(Template.shared == True)
    return jsonify([t.to_dict() for t in query.order_by(Template.created_at.desc()).all()])


@app.route('/api/templates', methods=['POST'])
def create_template():
    data = request.json
    current = get_current_user()
    t = Template(
        title=data['title'], body=data['body'],
        owner=current.name if current else '',
        owner_id=current.id if current else None,
        shared=data.get('shared', True),
    )
    db.session.add(t)
    db.session.commit()
    return jsonify(t.to_dict()), 201


@app.route('/api/templates/<int:tid>', methods=['PUT'])
def update_template(tid):
    t = Template.query.get_or_404(tid)
    data = request.json
    if 'title' in data: t.title = data['title']
    if 'body' in data: t.body = data['body']
    if 'shared' in data: t.shared = data['shared']
    db.session.commit()
    return jsonify(t.to_dict())


@app.route('/api/templates/<int:tid>', methods=['DELETE'])
def delete_template(tid):
    t = Template.query.get_or_404(tid)
    db.session.delete(t)
    db.session.commit()
    return jsonify({'ok': True})


# ─── Campaigns ───────────────────────────────────────────────────────────────

@app.route('/api/campaigns', methods=['GET'])
def list_campaigns():
    campaigns = Campaign.query.order_by(Campaign.created_at.desc()).all()
    return jsonify([c.to_dict() for c in campaigns])


@app.route('/api/campaigns/<int:cid>', methods=['GET'])
def get_campaign(cid):
    c = Campaign.query.get_or_404(cid)
    return jsonify(c.to_dict())


@app.route('/api/campaigns', methods=['POST'])
def create_campaign():
    data = request.json
    current = get_current_user()
    tags = ','.join(data.get('tags', [])) if isinstance(data.get('tags'), list) else data.get('tags', '')
    c = Campaign(
        name=data['name'], message_template=data['message_template'], tags=tags,
        provider=data.get('provider', get_active_provider()),
        campaign_type=data.get('campaign_type', 'one_time'),
        scheduled_at=datetime.fromisoformat(data['scheduled_at']) if data.get('scheduled_at') else None,
        frequency=data.get('frequency'),
        created_by=current.id if current else None,
    )
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201


@app.route('/api/campaigns/<int:cid>/send', methods=['POST'])
def send_campaign(cid):
    campaign = Campaign.query.get_or_404(cid)
    if campaign.status == 'sending':
        return jsonify({'error': 'Campaign already sending'}), 400

    if campaign.tags:
        tag_list = [t.strip() for t in campaign.tags.split(',') if t.strip()]
        contacts = Contact.query.filter(Contact.opted_out == False, Contact.blocked == False, Contact.invalid == False).all()
        contacts = [c for c in contacts if any(
            tag in [t.strip() for t in c.tags.split(',') if t.strip()] for tag in tag_list
        )]
    else:
        contacts = Contact.query.filter(Contact.opted_out == False, Contact.blocked == False, Contact.invalid == False).all()

    if not contacts:
        return jsonify({'error': 'No contacts matched'}), 400

    contacts = contacts[:10000]
    opt_out_suffix = '\nReply STOP to opt out'
    for contact in contacts:
        body = campaign.message_template
        body = body.replace('{name}', contact.name or '')
        body = body.replace('{first_name}', contact.first_name or '')
        body = body.replace('{last_name}', contact.last_name or '')
        body = body.replace('{business}', contact.business or '')
        body = body.replace('{email}', contact.email or '')
        body += opt_out_suffix
        bm = BlastMessage(
            campaign_id=campaign.id, contact_id=contact.id,
            phone=contact.phone, contact_name=contact.name, body=body,
        )
        db.session.add(bm)

    campaign.total_messages = len(contacts)
    campaign.sent_count = 0
    campaign.delivered_count = 0
    campaign.failed_count = 0
    campaign.replied_count = 0
    campaign.status = 'sending'
    db.session.commit()

    thread = threading.Thread(target=_run_blast, args=(app, campaign.id))
    thread.daemon = True
    thread.start()
    return jsonify(campaign.to_dict())


def _run_blast(app, campaign_id):
    with app.app_context():
        campaign = Campaign.query.get(campaign_id)
        messages = BlastMessage.query.filter_by(campaign_id=campaign_id, status='queued').all()
        batch_size = 100
        for i in range(0, len(messages), batch_size):
            batch = messages[i:i + batch_size]
            for bm in batch:
                try:
                    sid, _ = send_sms(bm.phone, bm.body, campaign.provider)
                    bm.sid = sid
                    bm.status = 'sent'
                    bm.sent_at = datetime.now(timezone.utc)
                    campaign.sent_count += 1
                except Exception as e:
                    bm.status = 'failed'
                    bm.error_message = str(e)[:500]
                    campaign.failed_count += 1
                db.session.commit()
            if i + batch_size < len(messages):
                time.sleep(1)
        campaign.status = 'completed'
        db.session.commit()


@app.route('/api/campaigns/<int:cid>/progress', methods=['GET'])
def campaign_progress(cid):
    c = Campaign.query.get_or_404(cid)
    return jsonify({
        'status': c.status, 'total': c.total_messages,
        'sent': c.sent_count, 'delivered': c.delivered_count,
        'failed': c.failed_count, 'replied': c.replied_count,
    })


@app.route('/api/campaigns/<int:cid>/messages', methods=['GET'])
def campaign_messages(cid):
    Campaign.query.get_or_404(cid)
    status_filter = request.args.get('status', '')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 30))
    query = BlastMessage.query.filter_by(campaign_id=cid)
    if status_filter:
        query = query.filter(BlastMessage.status == status_filter)
    total = query.count()
    messages = query.order_by(BlastMessage.created_at.asc()).offset((page - 1) * per_page).limit(per_page).all()
    return jsonify({'messages': [m.to_dict() for m in messages], 'total': total, 'page': page, 'per_page': per_page})


@app.route('/api/campaigns/<int:cid>/export', methods=['GET'])
def export_campaign(cid):
    Campaign.query.get_or_404(cid)
    messages = BlastMessage.query.filter_by(campaign_id=cid).order_by(BlastMessage.created_at.asc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Name', 'Phone', 'Status', 'Sent At', 'Delivered At', 'Error'])
    for m in messages:
        writer.writerow([m.contact_name, m.phone, m.status, m.sent_at or '', m.delivered_at or '', m.error_message])
    return Response(output.getvalue(), mimetype='text/csv',
                    headers={'Content-Disposition': f'attachment; filename=campaign_{cid}.csv'})


# ─── Analytics ───────────────────────────────────────────────────────────────

@app.route('/api/analytics', methods=['GET'])
def analytics():
    start = request.args.get('start_date', '')
    end = request.args.get('end_date', '')
    end_dt = None

    msg_query = Message.query
    if start:
        msg_query = msg_query.filter(Message.created_at >= datetime.fromisoformat(start))
    if end:
        end_dt = datetime.fromisoformat(end) + timedelta(days=1)
        msg_query = msg_query.filter(Message.created_at < end_dt)

    msgs = msg_query.all()
    tw = {'sent': 0, 'delivered': 0, 'failed': 0, 'received': 0}
    sw = {'sent': 0, 'delivered': 0, 'failed': 0, 'received': 0}
    total_convos = set()
    for m in msgs:
        total_convos.add(m.conversation_id)
        bucket = tw if m.provider == 'twilio' else sw
        if m.direction == 'outbound':
            bucket['sent'] += 1
            if m.status == 'delivered': bucket['delivered'] += 1
            elif m.status in ('failed', 'undelivered'): bucket['failed'] += 1
        elif m.direction == 'inbound':
            bucket['received'] += 1

    total_sent = tw['sent'] + sw['sent']
    total_received = tw['received'] + sw['received']
    total_delivered = tw['delivered'] + sw['delivered']
    engagement = round((total_received / total_sent * 100), 1) if total_sent > 0 else 0

    campaigns_sent = db.session.query(Campaign.id).filter(Campaign.status.in_(['sending', 'completed'])).count()

    return jsonify({
        'twilio': tw, 'signalwire': sw,
        'overview': {
            'conversations': len(total_convos), 'sent': total_sent,
            'received': total_received, 'delivered': total_delivered,
            'engagement_rate': engagement, 'campaigns_sent': campaigns_sent,
        },
        'contacts': {
            'total': Contact.query.count(), 'opted_out': Contact.query.filter_by(opted_out=True).count(),
        },
    })


@app.route('/api/analytics/team', methods=['GET'])
def analytics_team():
    start = request.args.get('start_date', '')
    end = request.args.get('end_date', '')
    users = User.query.all()
    result = []
    for u in users:
        convos = Conversation.query.filter_by(assigned_to=u.id).all()
        cids = [c.id for c in convos]
        if not cids:
            result.append({'name': u.name, 'role': u.role, 'sent': 0, 'delivered': 0, 'failed': 0, 'received': 0,
                           'delivered_rate': 0, 'failed_rate': 0})
            continue
        q = Message.query.filter(Message.conversation_id.in_(cids))
        if start: q = q.filter(Message.created_at >= datetime.fromisoformat(start))
        if end: q = q.filter(Message.created_at < datetime.fromisoformat(end) + timedelta(days=1))
        msgs = q.all()
        sent = sum(1 for m in msgs if m.direction == 'outbound')
        delivered = sum(1 for m in msgs if m.status == 'delivered')
        failed = sum(1 for m in msgs if m.status in ('failed', 'undelivered'))
        received = sum(1 for m in msgs if m.direction == 'inbound')
        result.append({
            'name': u.name, 'role': u.role,
            'sent': sent, 'delivered': delivered, 'failed': failed, 'received': received,
            'delivered_rate': round(delivered / sent * 100, 1) if sent > 0 else 0,
            'failed_rate': round(failed / sent * 100, 1) if sent > 0 else 0,
        })
    return jsonify(result)


@app.route('/api/analytics/export', methods=['GET'])
def export_analytics():
    users = User.query.all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Name', 'Role', 'Sent', 'Delivered', 'Failed', 'Received'])
    for u in users:
        convos = Conversation.query.filter_by(assigned_to=u.id).all()
        cids = [c.id for c in convos]
        if not cids:
            writer.writerow([u.name, u.role, 0, 0, 0, 0])
            continue
        msgs = Message.query.filter(Message.conversation_id.in_(cids)).all()
        writer.writerow([
            u.name, u.role,
            sum(1 for x in msgs if x.direction == 'outbound'),
            sum(1 for x in msgs if x.status == 'delivered'),
            sum(1 for x in msgs if x.status in ('failed', 'undelivered')),
            sum(1 for x in msgs if x.direction == 'inbound'),
        ])
    return Response(output.getvalue(), mimetype='text/csv',
                    headers={'Content-Disposition': 'attachment; filename=analytics.csv'})


# ─── Serve React frontend ────────────────────────────────────────────────────

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')


# ─── Init DB + Seed ──────────────────────────────────────────────────────────

def _seed_users():
    if User.query.count() == 0:
        for name, email, role in SEED_USERS:
            db.session.add(User(name=name, email=email, role=role))
        db.session.commit()
        print("Seeded users")


with app.app_context():
    try:
        db.create_all()
        _seed_users()
        print(f"Database initialized at {db_url}")
    except Exception as e:
        print(f"Database initialization error: {e}")

if __name__ == '__main__':
    app.run(debug=True, port=5000)
