from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

db = SQLAlchemy()


class Setting(db.Model):
    __tablename__ = 'settings'
    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.String(500), nullable=False)


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(200), unique=True, nullable=True)
    role = db.Column(db.String(50), default='user')
    avatar_url = db.Column(db.String(500), default='')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_login = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'email': self.email or '',
            'role': self.role, 'avatar_url': self.avatar_url or '',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
        }


class Contact(db.Model):
    __tablename__ = 'contacts'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, default='')
    first_name = db.Column(db.String(100), default='')
    last_name = db.Column(db.String(100), default='')
    phone = db.Column(db.String(20), nullable=False, unique=True)
    email = db.Column(db.String(200), default='')
    business = db.Column(db.String(200), default='')
    tags = db.Column(db.String(500), default='')
    opted_out = db.Column(db.Boolean, default=False)
    blocked = db.Column(db.Boolean, default=False)
    invalid = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name,
            'first_name': self.first_name, 'last_name': self.last_name,
            'phone': self.phone, 'email': self.email,
            'business': self.business,
            'tags': [t.strip() for t in self.tags.split(',') if t.strip()] if self.tags else [],
            'opted_out': self.opted_out, 'blocked': self.blocked, 'invalid': self.invalid,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class ContactImport(db.Model):
    __tablename__ = 'contact_imports'
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(500), nullable=False)
    total_rows = db.Column(db.Integer, default=0)
    created_count = db.Column(db.Integer, default=0)
    skipped_count = db.Column(db.Integer, default=0)
    duplicate_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id, 'filename': self.filename,
            'total_rows': self.total_rows, 'created_count': self.created_count,
            'skipped_count': self.skipped_count, 'duplicate_count': self.duplicate_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Conversation(db.Model):
    __tablename__ = 'conversations'
    id = db.Column(db.Integer, primary_key=True)
    phone = db.Column(db.String(20), nullable=False, unique=True)
    contact_name = db.Column(db.String(200), default='')
    last_message = db.Column(db.Text, default='')
    last_message_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    starred = db.Column(db.Boolean, default=False)
    status = db.Column(db.String(20), default='open')
    messages = db.relationship('Message', backref='conversation', lazy='dynamic')
    events = db.relationship('ConversationEvent', backref='conversation', lazy='dynamic')
    assignee = db.relationship('User', foreign_keys=[assigned_to])

    def to_dict(self):
        return {
            'id': self.id, 'phone': self.phone,
            'contact_name': self.contact_name,
            'last_message': self.last_message,
            'last_message_at': self.last_message_at.isoformat() if self.last_message_at else None,
            'assigned_to': self.assigned_to,
            'assigned_name': self.assignee.name if self.assignee else None,
            'starred': self.starred, 'status': self.status,
        }


class ConversationEvent(db.Model):
    __tablename__ = 'conversation_events'
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.id'), nullable=False)
    event_type = db.Column(db.String(50), nullable=False)
    details = db.Column(db.Text, default='')
    created_by = db.Column(db.String(200), default='')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id, 'conversation_id': self.conversation_id,
            'event_type': self.event_type, 'details': self.details,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Message(db.Model):
    __tablename__ = 'messages'
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.id'), nullable=False)
    direction = db.Column(db.String(10), nullable=False)
    body = db.Column(db.Text, nullable=False)
    provider = db.Column(db.String(20), default='')
    status = db.Column(db.String(20), default='sent')
    sid = db.Column(db.String(100), default='')
    is_note = db.Column(db.Boolean, default=False)
    sender_name = db.Column(db.String(200), default='')
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id, 'conversation_id': self.conversation_id,
            'direction': self.direction, 'body': self.body,
            'provider': self.provider, 'status': self.status,
            'is_note': self.is_note, 'sender_name': self.sender_name,
            'sender_id': self.sender_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Template(db.Model):
    __tablename__ = 'templates'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=False)
    owner = db.Column(db.String(200), default='')
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    shared = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id, 'title': self.title, 'body': self.body,
            'owner': self.owner, 'owner_id': self.owner_id, 'shared': self.shared,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Campaign(db.Model):
    __tablename__ = 'campaigns'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    message_template = db.Column(db.Text, nullable=False)
    tags = db.Column(db.String(500), default='')
    provider = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), default='draft')
    campaign_type = db.Column(db.String(20), default='one_time')
    scheduled_at = db.Column(db.DateTime, nullable=True)
    frequency = db.Column(db.String(20), nullable=True)
    total_messages = db.Column(db.Integer, default=0)
    sent_count = db.Column(db.Integer, default=0)
    delivered_count = db.Column(db.Integer, default=0)
    failed_count = db.Column(db.Integer, default=0)
    replied_count = db.Column(db.Integer, default=0)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name,
            'message_template': self.message_template,
            'tags': [t.strip() for t in self.tags.split(',') if t.strip()] if self.tags else [],
            'provider': self.provider, 'status': self.status,
            'campaign_type': self.campaign_type,
            'scheduled_at': self.scheduled_at.isoformat() if self.scheduled_at else None,
            'frequency': self.frequency,
            'total_messages': self.total_messages,
            'sent_count': self.sent_count, 'delivered_count': self.delivered_count,
            'failed_count': self.failed_count, 'replied_count': self.replied_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class BlastMessage(db.Model):
    __tablename__ = 'blast_messages'
    id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey('campaigns.id'), nullable=False)
    contact_id = db.Column(db.Integer, db.ForeignKey('contacts.id'), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    contact_name = db.Column(db.String(200), default='')
    body = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default='queued')
    sid = db.Column(db.String(100), default='')
    error_message = db.Column(db.Text, default='')
    delivered_at = db.Column(db.DateTime, nullable=True)
    replied_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    sent_at = db.Column(db.DateTime, nullable=True)

    contact = db.relationship('Contact', backref='blast_messages')
    campaign = db.relationship('Campaign', backref='blast_messages')

    def to_dict(self):
        return {
            'id': self.id, 'campaign_id': self.campaign_id,
            'contact_id': self.contact_id, 'phone': self.phone,
            'contact_name': self.contact_name, 'body': self.body,
            'status': self.status, 'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'delivered_at': self.delivered_at.isoformat() if self.delivered_at else None,
            'replied_at': self.replied_at.isoformat() if self.replied_at else None,
        }


class DailyMessageCount(db.Model):
    __tablename__ = 'daily_message_counts'
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    provider = db.Column(db.String(20), default='')
    count = db.Column(db.Integer, default=0)
