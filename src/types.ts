export type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  source?: string;
  createdAt: string;
  notes?: string;
};

export type Interaction = {
  id: string;
  customerId: string;
  channel: 'call' | 'sms' | 'whatsapp' | 'visit' | 'note';
  text: string;
  at: string;
};

export type Service = { id: string; name: string; durationMin: number; price: number };
export type Resource = { id: string; name: string; type: 'staff' | 'room' };

export type AppointmentStatus = 'booked' | 'confirmed' | 'done' | 'noshow' | 'cancelled';
export type Appointment = {
  id: string;
  customerId: string;
  serviceId: string;
  resourceId: string;
  start: string; // ISO UTC
  end: string; // ISO UTC
  status: AppointmentStatus;
};

export type OrderStatus = 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export type Order = {
  id: string;
  customerId: string;
  items: { name: string; qty: number; price: number }[];
  status: OrderStatus;
  createdAt: string;
  promisedAt?: string;
};
export type OrderStatusLog = { id: string; orderId: string; from: string; to: string; at: string };

export type Task = { id: string; title: string; customerId?: string; dueAt: string; done: boolean };

export type Ticket = {
  id: string;
  customerId: string;
  subject: string;
  priority: 'low' | 'normal' | 'high';
  status: 'open' | 'pending' | 'resolved';
  createdAt: string;
};

export type Rule = {
  id: string;
  name: string;
  trigger: string;
  condition: string;
  action: string;
  active: boolean;
};

export type OutboxMessage = { id: string; to: string; body: string; channel: 'sms'; at: string };
