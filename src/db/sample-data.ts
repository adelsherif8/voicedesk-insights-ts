/**
 * SAMPLE DATA - not real calls. Fictional callers, phone numbers from the reserved 555-0100..0199 fictional range and example.com emails,
 * adapted from the demo seed in the Python VoiceDesk app. Every row is written with is_sample=true.
 */
import type { NewCallOutcome } from './schema.js';

type Sample = Omit<NewCallOutcome, 'id' | 'isSample' | 'createdAt'> & { minutesAgo: number };

export const SAMPLE_CALL_OUTCOMES: Sample[] = [
  { agent: 'receptionist', callerName: 'Sarah Johnson', phone: '+1 202 555 0101', email: 'sarah@example.com', intent: 'Rent a storage unit', outcome: 'Reserved 10x10', appointment: 'Tour Mon 2:00 PM', summary: 'Moving apartments. Reserved a 10x10 and booked a tour.', meta: { call_type: 'rental', unit_size: '10x10', monthly_price: 110 }, minutesAgo: 25 },
  { agent: 'receptionist', callerName: 'Priya Nair', phone: '+1 202 555 0102', intent: 'Pay monthly bill', outcome: 'Payment collected', summary: 'Existing tenant, unit B-14. Paid $110 by card; enrolled in autopay.', meta: { call_type: 'payment', unit: 'B-14', amount: 110 }, minutesAgo: 43 },
  { agent: 'receptionist', callerName: 'Tom Alvarez', phone: '+1 202 555 0103', intent: 'Climate-control pricing question', outcome: 'Follow-up sent', summary: 'Comparing 10x20 vs climate-controlled; not ready to book. Quote texted, follow-up in 2 days.', meta: { call_type: 'rental', unit_size: '10x20' }, minutesAgo: 87 },
  { agent: 'receptionist', callerName: 'Dana Whitfield', phone: '+1 202 555 0104', intent: 'Gate code not working', outcome: 'Access restored', summary: 'Tenant locked out at the gate. Verified phone on account, issued new gate code.', meta: { call_type: 'access', unit: 'C-07' }, minutesAgo: 115 },
  { agent: 'receptionist', callerName: 'Luis Ortega', phone: '+1 202 555 0105', intent: 'Office hours and truck rental', outcome: 'Answered', summary: 'Asked about office hours and whether a moving truck is available. Answered from facility FAQ.', meta: { call_type: 'general' }, minutesAgo: 200 },
  { agent: 'restaurant', callerName: 'Marcus Bell', phone: '+1 202 555 0106', intent: 'Takeout · lasagna + cannoli', outcome: 'Order to kitchen · $47.00', appointment: 'Pickup 7:05 PM', summary: 'Takeout order, total $47.00 read back; paid by card; ticket printed to kitchen.', meta: { kind: 'order', total: 47 }, minutesAgo: 55 },
  { agent: 'restaurant', callerName: 'Tom Alvarez', phone: '+1 202 555 0107', intent: 'Reservation · 8 · Saturday 8 PM', outcome: 'Table T8 · deposit taken', appointment: 'Sat 8:00 PM · party of 8', summary: 'Birthday party of eight Saturday 8 PM. T8 held with $50 card deposit.', meta: { kind: 'reservation', party: 8 }, minutesAgo: 150 },
  { agent: 'restaurant', callerName: 'Elena Voss', phone: '+1 202 555 0108', intent: 'Are you open Monday? Parking?', outcome: 'Answered · FAQ', summary: 'Asked about Monday hours (closed) and parking. Offered to book Tuesday.', meta: { kind: 'faq' }, minutesAgo: 200 },
  { agent: 'dental', callerName: 'Karen Ellis', phone: '+1 202 555 0109', intent: 'Confirmation call · cleaning Tue 9:00', outcome: 'Confirmed', appointment: 'Tue 9:00 AM · Hygiene', summary: 'Reminder call: confirmed hygiene visit Tuesday 9 AM.', meta: { kind: 'reminder' }, minutesAgo: 32 },
  { agent: 'dental', callerName: 'Ben Okafor', phone: '+1 202 555 0110', intent: 'Hygiene recall · 7 months overdue', outcome: 'Recall booked', appointment: 'Thu 3:00 PM · Hygiene', summary: 'Overdue hygiene recall: booked Thursday 3 PM cleaning and exam.', meta: { kind: 'recall', overdue_months: 7 }, minutesAgo: 132 },
  { agent: 'dental', callerName: 'Lena Hoffmann', phone: '+1 202 555 0111', intent: 'Tooth pain, same day?', outcome: 'Emergency · same day booked', appointment: 'Mon 4:30 PM', summary: 'Severe pain and swelling. Triaged as urgent; booked same-day 4:30 PM; on-call line notified.', meta: { kind: 'emergency' }, minutesAgo: 200 },
  { agent: 'realty', callerName: 'Grace Lin', phone: '+1 202 555 0112', intent: 'Inquiry · 88 Maple Ridge Ln', outcome: 'Qualified · routed to listing agent', summary: 'Yard-sign call. Cash buyer, wants a showing this week. Routed to listing agent with notes.', meta: { source: 'Yard sign', score: 95 }, minutesAgo: 85 },
  { agent: 'realty', callerName: 'Daniel Osei', phone: '+1 202 555 0113', email: 'd.osei@example.com', intent: 'Inquiry · 14 Harbor View Dr', outcome: 'Nurture · not pre-approved', summary: 'Not pre-approved yet; 6+ months out. Sent lender intro and listing alerts; follow-up in 2 weeks.', meta: { source: 'Portal', score: 42 }, minutesAgo: 150 },
  { agent: 'realty', callerName: 'Leo Marin', phone: '+1 202 555 0114', intent: 'Inquiry · 19 Cedar Ct', outcome: 'Pending · offered alternatives', summary: 'Listing is under contract. Suggested a similar listing; caller wants photos first.', meta: { source: 'Search', score: 61 }, minutesAgo: 283 },
  { agent: 'recovery', callerName: 'Ana Ruiz', phone: '+1 202 555 0115', intent: 'Toilet will not stop running', outcome: 'Missed · text-back sending', summary: 'Missed call while crew was on a job. Text-back queued; callback scheduled.', meta: { flow: 'missed', value: 220 }, minutesAgo: 1 },
  { agent: 'recovery', callerName: 'Denise Park', phone: '+1 202 555 0116', intent: 'Annual water heater flush', outcome: 'Reactivated · $189', appointment: 'Tue 11 AM', summary: 'Last visit 14 months ago. Booked annual flush and inspection.', meta: { flow: 'reactivation', value: 189 }, minutesAgo: 90 },
  { agent: 'recovery', callerName: 'Sandra Wu', phone: '+1 202 555 0117', email: 'sandra.w@example.com', intent: 'Repipe estimate follow-up', outcome: 'Follow-up · deciding', summary: 'Estimate open 6 days; caller comparing quotes. Sent itemised breakdown; callback Friday.', meta: { flow: 'estimate', value: 6800 }, minutesAgo: 163 },
  { agent: 'support', callerName: 'Olivia Chen', phone: '+1 202 555 0118', intent: 'Fridge not cooling', outcome: 'Technician booked', appointment: 'Thu 9-11 AM', summary: 'In warranty. Likely evaporator fan. Booked technician, part pre-ordered.', meta: { resolution: 'dispatch', csat: 5 }, minutesAgo: 30 },
  { agent: 'support', callerName: 'Devon Price', phone: '+1 202 555 0119', intent: 'Dishwasher error code 4C', outcome: 'Resolved by phone', summary: 'Walked caller through inlet hose check; hose was kinked. Resolved without a visit.', meta: { resolution: 'resolved', csat: 5 }, minutesAgo: 55 },
  { agent: 'support', callerName: 'Ray Coleman', phone: '+1 202 555 0120', intent: 'Washer leaking, 3rd call', outcome: 'Transferred to human', summary: 'Third contact, repair failed twice. Frustration detected; warm transfer to a senior agent.', meta: { resolution: 'transfer', sentiment: 'frustrated' }, minutesAgo: 127 },
  { agent: 'sales', callerName: 'Carlos Mendez', phone: '+1 202 555 0121', email: 'carlos.m@example.com', intent: 'AC not cooling upstairs', outcome: 'Estimate booked', appointment: 'Tomorrow 10:00 AM', summary: 'Web form lead called back within a minute. Booked diagnostic and estimate.', meta: { source: 'Website form' }, minutesAgo: 40 },
  { agent: 'sales', callerName: 'Tom Whitaker', phone: '+1 202 555 0122', intent: 'Furnace tune-up', outcome: 'Retry scheduled', summary: 'No answer on attempts 1-2 (voicemail and SMS sent). Next call 4:30 PM.', meta: { attempts: 2 }, minutesAgo: 120 },
  { agent: 'sales', callerName: 'Greg Olsen', phone: '+1 202 555 0123', intent: 'Price shopping, mini-split', outcome: 'Not now · nurture', summary: 'Renter, landlord decides. Added to a 30-day nurture SMS sequence.', meta: { nurture: true }, minutesAgo: 233 },
];

export function sampleRows(now: Date = new Date()): NewCallOutcome[] {
  return SAMPLE_CALL_OUTCOMES.map(({ minutesAgo, ...r }) => ({
    ...r,
    isSample: true,
    createdAt: new Date(now.getTime() - minutesAgo * 60_000),
  }));
}
