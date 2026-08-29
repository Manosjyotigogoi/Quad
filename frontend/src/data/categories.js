
export const categories = [
{ id: 'textbooks', label: 'Textbooks', count: 412, accent: 'text-acid' },
{ id: 'dorm', label: 'Dorm & furniture', count: 268, accent: 'text-grape' },
{ id: 'tech', label: 'Tech', count: 197, accent: 'text-sky' },
{ id: 'kitchen', label: 'Kitchen', count: 143, accent: 'text-tangerine' },
{ id: 'rides', label: 'Rides & bikes', count: 88, accent: 'text-rose' },
{ id: 'free', label: 'Free stuff', count: 61, accent: 'text-acid' }];


export const categoryLabel = (id) =>
categories.find((c) => c.id === id)?.label ?? 'Other';