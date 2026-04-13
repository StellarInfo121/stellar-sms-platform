import os
import csv
import io
import threading
import time
from datetime import datetime, timezone

import requests as http_requests
from requests.auth import HTTPBasicAuth

from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from twilio.rest import Client as TwilioClient

from models import db, Setting, Contact, Conversation, Message, Campaign, BlastMessage

load_dotenv()

app = Flask(__name__, static_folder='frontend/dist', static_url_path='')
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret')
db_url = os.getenv('DATABASE_URL', 'sqlite:///sms_platform.db')
if db_url == 'sqlite:///sms_platform.db' and os.path.exists('/tmp'):
    db_url = 'sqlite:////tmp/sms_platform.db'
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app)
db.init_app(app)

# --- Provider clients ---
TWILIO_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_PHONE = os.getenv('TWILIO_PHONE_NUMBER')

SW_PROJECT = os.getenv('SIGNALWIRE_PROJECT_ID')
SW_TOKEN = os.getenv('SIGNALWIRE_API_TOKEN')
SW_SPACE = os.getenv('SIGNALWIRE_SPACE_URL')
SW_PHONE = os.getenv('SIGNALWIRE_PHONE_NUMBER')

tw_client = TwilioClient(TWILIO_SID, TWILIO_TOKEN)


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
        print(f"[SignalWire ERROR] code={code} status={response.status_code} to={to} message={message}")
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
            code = getattr(e, 'code', '')
            print(f"[Twilio ERROR] code={code} to={to} error={e}")
            raise
    return sid, provider


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


# ─── Contacts ────────────────────────────────────────────────────────────────

@app.route('/api/contacts', methods=['GET'])
def list_contacts():
    q = request.args.get('search', '')
    query = Contact.query
    if q:
        like = f'%{q}%'
        query = query.filter(
            db.or_(Contact.name.ilike(like), Contact.phone.ilike(like),
                   Contact.business.ilike(like), Contact.tags.ilike(like))
        )
    contacts = query.order_by(Contact.created_at.desc()).all()
    return jsonify([c.to_dict() for c in contacts])


@app.route('/api/contacts', methods=['POST'])
def create_contact():
    data = request.json
    tags = ','.join(data.get('tags', [])) if isinstance(data.get('tags'), list) else data.get('tags', '')
    c = Contact(
        name=data['name'], phone=data['phone'],
        business=data.get('business', ''), tags=tags
    )
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201


@app.route('/api/contacts/<int:contact_id>', methods=['PUT'])
def update_contact(contact_id):
    c = Contact.query.get_or_404(contact_id)
    data = request.json
    c.name = data.get('name', c.name)
    c.phone = data.get('phone', c.phone)
    c.business = data.get('business', c.business)
    if 'tags' in data:
        c.tags = ','.join(data['tags']) if isinstance(data['tags'], list) else data['tags']
    if 'opted_out' in data:
        c.opted_out = data['opted_out']
    db.session.commit()
    return jsonify(c.to_dict())


@app.route('/api/contacts/<int:contact_id>', methods=['DELETE'])
def delete_contact(contact_id):
    c = Contact.query.get_or_404(contact_id)
    db.session.delete(c)
    db.session.commit()
    return jsonify({'ok': True})


@app.route('/api/contacts/upload', methods=['POST'])
def upload_contacts():
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file'}), 400
    stream = io.StringIO(file.stream.read().decode('utf-8-sig'))
    reader = csv.DictReader(stream)
    created, skipped = 0, 0
    for row in reader:
        phone = row.get('phone', '').strip()
        if not phone:
            skipped += 1
            continue
        existing = Contact.query.filter_by(phone=phone).first()
        if existing:
            skipped += 1
            continue
        c = Contact(
            name=row.get('name', '').strip(),
            phone=phone,
            business=row.get('business', '').strip(),
            tags=row.get('tags', row.get('tag', '')).strip()
        )
        db.session.add(c)
        created += 1
    db.session.commit()
    return jsonify({'created': created, 'skipped': skipped})


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


# ─── Conversations / Messages ────────────────────────────────────────────────

@app.route('/api/conversations', methods=['GET'])
def list_conversations():
    convos = Conversation.query.order_by(Conversation.last_message_at.desc()).all()
    return jsonify([c.to_dict() for c in convos])


@app.route('/api/conversations/<int:convo_id>/messages', methods=['GET'])
def get_messages(convo_id):
    convo = Conversation.query.get_or_404(convo_id)
    msgs = convo.messages.order_by(Message.created_at.asc()).all()
    return jsonify([m.to_dict() for m in msgs])


@app.route('/api/sms/send', methods=['POST'])
def send_single_sms():
    data = request.json
    to = data['to']
    body = data['body']
    provider = data.get('provider')

    try:
        sid, used_provider = send_sms(to, body, provider)
    except Exception as e:
        error_msg = str(e)
        error_code = ''
        if hasattr(e, 'code'):
            error_code = str(e.code)
        elif hasattr(e, 'status'):
            error_code = str(e.status)
        print(f"[SMS SEND ERROR] provider={provider} to={to} error={error_msg}")
        return jsonify({'error': error_msg, 'error_code': error_code}), 400

    convo = Conversation.query.filter_by(phone=to).first()
    if not convo:
        contact = Contact.query.filter_by(phone=to).first()
        convo = Conversation(phone=to, contact_name=contact.name if contact else to)
        db.session.add(convo)
        db.session.flush()

    msg = Message(
        conversation_id=convo.id, direction='outbound',
        body=body, provider=used_provider, status='sent', sid=sid
    )
    db.session.add(msg)
    convo.last_message = body
    convo.last_message_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(msg.to_dict()), 201


# ─── Webhooks ────────────────────────────────────────────────────────────────

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
    # Handle STOP opt-out
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
        body=body, provider=provider, status='received', sid=sid
    )
    db.session.add(msg)
    convo.last_message = body
    convo.last_message_at = datetime.now(timezone.utc)
    db.session.commit()


# ─── Status callback (delivery receipts) ─────────────────────────────────────

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
            campaign = Campaign.query.get(bm.campaign_id)
            if campaign and status == 'delivered':
                campaign.delivered_count += 1
            elif campaign and status in ('failed', 'undelivered'):
                campaign.failed_count += 1
            db.session.commit()
    return '', 204


# ─── Campaigns ────────────────────────────────────────────────────────────────

@app.route('/api/campaigns', methods=['GET'])
def list_campaigns():
    campaigns = Campaign.query.order_by(Campaign.created_at.desc()).all()
    return jsonify([c.to_dict() for c in campaigns])


@app.route('/api/campaigns/<int:campaign_id>', methods=['GET'])
def get_campaign(campaign_id):
    c = Campaign.query.get_or_404(campaign_id)
    return jsonify(c.to_dict())


@app.route('/api/campaigns', methods=['POST'])
def create_campaign():
    data = request.json
    tags = ','.join(data.get('tags', [])) if isinstance(data.get('tags'), list) else data.get('tags', '')
    c = Campaign(
        name=data['name'],
        message_template=data['message_template'],
        tags=tags,
        provider=data.get('provider', get_active_provider()),
    )
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201


@app.route('/api/campaigns/<int:campaign_id>/send', methods=['POST'])
def send_campaign(campaign_id):
    campaign = Campaign.query.get_or_404(campaign_id)
    if campaign.status == 'sending':
        return jsonify({'error': 'Campaign already sending'}), 400

    # Resolve contacts
    if campaign.tags:
        tag_list = [t.strip() for t in campaign.tags.split(',') if t.strip()]
        contacts = Contact.query.filter(Contact.opted_out == False).all()
        contacts = [c for c in contacts if any(
            tag in [t.strip() for t in c.tags.split(',') if t.strip()]
            for tag in tag_list
        )]
    else:
        contacts = Contact.query.filter(Contact.opted_out == False).all()

    if not contacts:
        return jsonify({'error': 'No contacts matched'}), 400

    # Cap at 10000
    contacts = contacts[:10000]

    # Create blast messages
    opt_out_suffix = '\nReply STOP to opt out'
    for contact in contacts:
        body = campaign.message_template
        body = body.replace('{name}', contact.name or '')
        body = body.replace('{business}', contact.business or '')
        body += opt_out_suffix
        bm = BlastMessage(
            campaign_id=campaign.id,
            contact_id=contact.id,
            phone=contact.phone,
            body=body,
        )
        db.session.add(bm)

    campaign.total_messages = len(contacts)
    campaign.sent_count = 0
    campaign.delivered_count = 0
    campaign.failed_count = 0
    campaign.status = 'sending'
    db.session.commit()

    # Launch blast in background thread
    thread = threading.Thread(target=_run_blast, args=(app, campaign.id))
    thread.daemon = True
    thread.start()

    return jsonify(campaign.to_dict())


def _run_blast(app, campaign_id):
    with app.app_context():
        campaign = Campaign.query.get(campaign_id)
        messages = BlastMessage.query.filter_by(
            campaign_id=campaign_id, status='queued'
        ).all()

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

            # 1-second delay between batches
            if i + batch_size < len(messages):
                time.sleep(1)

        campaign.status = 'completed'
        db.session.commit()


@app.route('/api/campaigns/<int:campaign_id>/progress', methods=['GET'])
def campaign_progress(campaign_id):
    c = Campaign.query.get_or_404(campaign_id)
    return jsonify({
        'status': c.status,
        'total': c.total_messages,
        'sent': c.sent_count,
        'delivered': c.delivered_count,
        'failed': c.failed_count,
    })


# ─── Analytics ────────────────────────────────────────────────────────────────

@app.route('/api/analytics', methods=['GET'])
def analytics():
    # Per-provider stats from messages
    tw_sent = Message.query.filter_by(provider='twilio', direction='outbound').count()
    tw_delivered = Message.query.filter(
        Message.provider == 'twilio', Message.status == 'delivered'
    ).count()
    tw_failed = Message.query.filter(
        Message.provider == 'twilio', Message.status.in_(['failed', 'undelivered'])
    ).count()
    tw_received = Message.query.filter_by(provider='twilio', direction='inbound').count()

    sw_sent = Message.query.filter_by(provider='signalwire', direction='outbound').count()
    sw_delivered = Message.query.filter(
        Message.provider == 'signalwire', Message.status == 'delivered'
    ).count()
    sw_failed = Message.query.filter(
        Message.provider == 'signalwire', Message.status.in_(['failed', 'undelivered'])
    ).count()
    sw_received = Message.query.filter_by(provider='signalwire', direction='inbound').count()

    # Blast stats
    blast_sent = BlastMessage.query.filter_by(status='sent').count()
    blast_delivered = BlastMessage.query.filter_by(status='delivered').count()
    blast_failed = BlastMessage.query.filter_by(status='failed').count()
    blast_queued = BlastMessage.query.filter_by(status='queued').count()

    total_contacts = Contact.query.count()
    opted_out = Contact.query.filter_by(opted_out=True).count()

    return jsonify({
        'twilio': {
            'sent': tw_sent, 'delivered': tw_delivered,
            'failed': tw_failed, 'received': tw_received,
        },
        'signalwire': {
            'sent': sw_sent, 'delivered': sw_delivered,
            'failed': sw_failed, 'received': sw_received,
        },
        'blasts': {
            'sent': blast_sent, 'delivered': blast_delivered,
            'failed': blast_failed, 'queued': blast_queued,
        },
        'contacts': {
            'total': total_contacts, 'opted_out': opted_out,
        },
    })


# ─── Serve React frontend ────────────────────────────────────────────────────

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')


# ─── Init DB ──────────────────────────────────────────────────────────────────

with app.app_context():
    try:
        db.create_all()
        print(f"Database initialized at {db_url}")
    except Exception as e:
        print(f"Database initialization error: {e}")

if __name__ == '__main__':
    app.run(debug=True, port=5000)
