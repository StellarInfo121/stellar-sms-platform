from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

db = SQLAlchemy()


class Setting(db.Model):
    __tablename__ = 'settings'
    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.String(500), nullable=False)


class Contact(db.Model):
    __tablename__ = 'contacts'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(20), nullable=False, unique=True)
    business = db.Column(db.String(200), default='')
    tags = db.Column(db.String(500), default='')
    opted_out = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'phone': self.phone,
            'business': self.business,
            'tags': [t.strip() for t in self.tags.split(',') if t.strip()] if self.tags else [],
            'opted_out': self.opted_out,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Conversation(db.Model):
    __tablename__ = 'conversations'
    id = db.Column(db.Integer, primary_key=True)
    phone = db.Column(db.String(20), nullable=False, unique=True)
    contact_name = db.Column(db.String(200), default='')
    last_message = db.Column(db.Text, default='')
    last_message_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    messages = db.relationship('Message', backref='conversation', lazy='dynamic', order_by='Message.created_at')

    def to_dict(self):
        return {
            'id': self.id,
            'phone': self.phone,
            'contact_name': self.contact_name,
            'last_message': self.last_message,
            'last_message_at': self.last_message_at.isoformat() if self.last_message_at else None,
        }


class Message(db.Model):
    __tablename__ = 'messages'
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.id'), nullable=False)
    direction = db.Column(db.String(10), nullable=False)  # inbound / outbound
    body = db.Column(db.Text, nullable=False)
    provider = db.Column(db.String(20), default='')  # twilio / signalwire
    status = db.Column(db.String(20), default='sent')
    sid = db.Column(db.String(100), default='')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'direction': self.direction,
            'body': self.body,
            'provider': self.provider,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Campaign(db.Model):
    __tablename__ = 'campaigns'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    message_template = db.Column(db.Text, nullable=False)
    tags = db.Column(db.String(500), default='')  # comma-separated, empty = all contacts
    provider = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), default='draft')  # draft / sending / completed / failed
    total_messages = db.Column(db.Integer, default=0)
    sent_count = db.Column(db.Integer, default=0)
    delivered_count = db.Column(db.Integer, default=0)
    failed_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'message_template': self.message_template,
            'tags': [t.strip() for t in self.tags.split(',') if t.strip()] if self.tags else [],
            'provider': self.provider,
            'status': self.status,
            'total_messages': self.total_messages,
            'sent_count': self.sent_count,
            'delivered_count': self.delivered_count,
            'failed_count': self.failed_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class BlastMessage(db.Model):
    __tablename__ = 'blast_messages'
    id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey('campaigns.id'), nullable=False)
    contact_id = db.Column(db.Integer, db.ForeignKey('contacts.id'), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    body = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default='queued')  # queued / sent / delivered / failed
    sid = db.Column(db.String(100), default='')
    error_message = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    sent_at = db.Column(db.DateTime, nullable=True)

    contact = db.relationship('Contact', backref='blast_messages')
    campaign = db.relationship('Campaign', backref='blast_messages')

    def to_dict(self):
        return {
            'id': self.id,
            'campaign_id': self.campaign_id,
            'contact_id': self.contact_id,
            'phone': self.phone,
            'body': self.body,
            'status': self.status,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
        }
