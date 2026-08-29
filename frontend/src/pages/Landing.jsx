import React, { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Hero } from '../components/landing/Hero';
import { MarketFeed } from '../components/landing/MarketFeed';
import { SellFlow } from '../components/landing/SellFlow';
import { CampusTrust } from '../components/landing/CampusTrust';
import { api } from '../utils/api';

export function Landing() {
  const [liveCount, setLiveCount] = useState(0);

  useEffect(() => {
    // Fetch the real count of active listings for the hero stat.
    api.getListings({ limit: 1 })
      .then((data) => setLiveCount(data.total || 0))
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col bg-ink-950">
      <Navbar />
      <main className="flex-1">
        <Hero liveCount={liveCount} />
        <MarketFeed />
        <SellFlow />
        <CampusTrust />
      </main>
      <Footer />
    </div>
  );
}
