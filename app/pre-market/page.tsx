"use client";

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import PreMarketMovers from '@/components/PreMarketMovers';

export default function PreMarketPage() {
    return (
        <div className="flex h-screen overflow-hidden bg-[#0a0a0a] text-white selection:bg-yellow-500/30">
            <Sidebar isOpen={true} />

            <main className="flex-1 overflow-y-auto relative h-full">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-yellow-500/5 rounded-full blur-[120px] pointer-events-none" />

                <div className="p-8 max-w-7xl mx-auto space-y-8 relative z-10 pt-16">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight mb-2">Pre-Market Intelligence</h1>
                        <p className="text-gray-400">Real-time catalyst scoring for top pre-market movers.</p>
                    </div>

                    <PreMarketMovers />
                </div>
            </main>
        </div>
    );
}
