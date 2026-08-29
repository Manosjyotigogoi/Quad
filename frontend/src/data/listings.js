
export const listings = [
{
  id: 'l1',
  title: 'Organic Chemistry 8th ed. + solutions manual',
  price: 45,
  wasPrice: 210,
  condition: 'Good',
  category: 'textbooks',
  image: "/39c584e6-0880-4108-ae1d-abec06aea0f2.jpg",

  seller: {
    name: 'Priya Raman',
    initials: 'PR',
    campus: 'North Quad',
    rating: 4.9,
    verified: true
  },
  postedAgo: '12 min ago',
  pickup: 'Science Library',
  watchers: 23
},
{
  id: 'l2',
  title: 'Mini fridge, 3.2 cu ft — runs cold, moving out',
  price: 60,
  wasPrice: 149,
  condition: 'Like new',
  category: 'dorm',
  image: "/964af720-798a-481c-90df-dd817c2b2552.jpg",

  seller: {
    name: 'Marcus Hale',
    initials: 'MH',
    campus: 'Hillcrest Hall',
    rating: 4.7,
    verified: true
  },
  postedAgo: '38 min ago',
  pickup: 'Hillcrest lobby',
  watchers: 41
},
{
  id: 'l3',
  title: '27" 1440p monitor, no dead pixels',
  price: 130,
  wasPrice: 299,
  condition: 'Good',
  category: 'tech',
  image: "/25d3bf21-b887-4bbf-b9dc-7e7dc250ebb8.jpg",

  seller: {
    name: 'Dani Okafor',
    initials: 'DO',
    campus: 'Engineering',
    rating: 5,
    verified: true
  },
  postedAgo: '1 hr ago',
  pickup: 'Ellis Engineering',
  watchers: 57
},
{
  id: 'l4',
  title: 'Single-speed commuter bike, new tires',
  price: 95,
  condition: 'Good',
  category: 'rides',
  image: "/6a8548ce-04b3-404c-a097-9cd1971e16d9.jpg",

  seller: {
    name: 'Sam Whitfield',
    initials: 'SW',
    campus: 'West Village',
    rating: 4.6,
    verified: true
  },
  postedAgo: '2 hrs ago',
  pickup: 'West bike racks',
  watchers: 19
},
{
  id: 'l5',
  title: 'Ergonomic mesh desk chair, adjustable arms',
  price: 75,
  wasPrice: 220,
  condition: 'Good',
  category: 'dorm',
  image: "/17ad4de3-6faa-42bb-873e-7f8a0864234e.jpg",

  seller: {
    name: 'Leah Kim',
    initials: 'LK',
    campus: 'Graduate Towers',
    rating: 4.8,
    verified: true
  },
  postedAgo: '3 hrs ago',
  pickup: 'Towers garage',
  watchers: 12
},
{
  id: 'l6',
  title: 'TI-84 Plus CE graphing calculator',
  price: 55,
  wasPrice: 120,
  condition: 'Like new',
  category: 'tech',
  image: "/7536d3fd-1b49-458d-ad55-735e4ab48450.jpg",

  seller: {
    name: 'Owen Barrett',
    initials: 'OB',
    campus: 'Math Building',
    rating: 4.5,
    verified: false
  },
  postedAgo: '4 hrs ago',
  pickup: 'Union food court',
  watchers: 33
},
{
  id: 'l7',
  title: 'Air fryer, barely used since first year',
  price: 32,
  condition: 'Like new',
  category: 'kitchen',
  image: "/e2a8b7ed-2e58-49b7-b2c7-f2697848e968.jpg",

  seller: {
    name: 'Aisha Noor',
    initials: 'AN',
    campus: 'Redwood Hall',
    rating: 4.9,
    verified: true
  },
  postedAgo: '5 hrs ago',
  pickup: 'Redwood front desk',
  watchers: 27
},
{
  id: 'l8',
  title: 'Patterned 5x7 area rug — free to a good dorm',
  price: 0,
  condition: 'Fair',
  category: 'free',
  image: "/c68b2664-459b-4ba1-8d97-c999d7741cf5.jpg",

  seller: {
    name: 'Theo Lange',
    initials: 'TL',
    campus: 'South Commons',
    rating: 4.4,
    verified: true
  },
  postedAgo: '6 hrs ago',
  pickup: 'South Commons',
  watchers: 64
},
{
  id: 'l9',
  title: 'LED desk lamp with USB-C passthrough',
  price: 18,
  wasPrice: 45,
  condition: 'Like new',
  category: 'dorm',
  image: "/f787bd2a-9c8e-4cdd-8fe1-3130ae841ab2.jpg",

  seller: {
    name: 'Nina Costa',
    initials: 'NC',
    campus: 'Art Annex',
    rating: 4.8,
    verified: true
  },
  postedAgo: '8 hrs ago',
  pickup: 'Art Annex studio',
  watchers: 9
},
{
  id: 'l10',
  title: 'Acoustic guitar, dreadnought — case included',
  price: 140,
  wasPrice: 320,
  condition: 'Good',
  category: 'dorm',
  image: "/c556d931-c363-46d6-9eec-84c8955b2eb2.jpg",

  seller: {
    name: 'Priya Raman',
    initials: 'PR',
    campus: 'North Quad',
    rating: 4.9,
    verified: true
  },
  postedAgo: '11 hrs ago',
  pickup: 'Music Hall',
  watchers: 48
}];


export const justListed = listings.slice(0, 3);