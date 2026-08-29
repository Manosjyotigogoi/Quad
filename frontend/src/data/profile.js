import { listings } from './listings';

export const profile = {
  name: 'Priya Raman',
  initials: 'PR',
  handle: '@priya.r',
  school: 'Westbrook University',
  major: 'Biochem, class of 2027',
  dorm: 'North Quad, floor 4',
  bio: 'Selling off my first-two-years pile — chem texts, lab gear, and the guitar I keep meaning to learn. Fast replies between labs, cash on pickup.',
  rating: 4.9,
  reviewCount: 38,
  joined: 'Joined Sep 2024',
  responseTime: 'Replies in ~20 min',
  itemsSold: 41,
  verified: true
};

export const profileListings = listings.filter(
  (l) => l.seller.name === profile.name
);

export const savedListings = listings.filter((l) =>
['l3', 'l5', 'l7'].includes(l.id)
);

export const soldListings = listings.filter((l) =>
['l6', 'l9'].includes(l.id)
);

export const reviews = [
{
  id: 'r1',
  author: 'Marcus Hale',
  initials: 'MH',
  rating: 5,
  body: 'Met me at the science library ten minutes after I messaged. Book was in better shape than described.',
  item: 'Organic Chemistry 8th ed.',
  when: '2 weeks ago'
},
{
  id: 'r2',
  author: 'Leah Kim',
  initials: 'LK',
  rating: 5,
  body: 'Super clear about the scratches, threw in the lab goggles for free. Would buy again.',
  item: 'Lab kit bundle',
  when: 'Last month'
},
{
  id: 'r3',
  author: 'Owen Barrett',
  initials: 'OB',
  rating: 4,
  body: 'Good deal and easy pickup. Had to reschedule once, but she was flexible about it.',
  item: 'Calculus notes + textbook',
  when: 'Last semester'
}];