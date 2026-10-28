import React, { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { Transaction } from '../../types';
import { getCurrentMonthDaysInfo } from '../../utils/forecast';

interface FinancialGraphProps {
  transactions: Transaction[];
  monthlyBudget: number;
  locale?: string;
  currency?: string;
}

export function FinancialGraph({ transactions, monthlyBudget, locale = 'en-US', currency = 'USD' }: FinancialGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { daysInMonth, currentDay } = getCurrentMonthDaysInfo();

  // Process transactions into daily spends for the current month
  const currentMonthTx = transactions.filter(t => {
    if (!t.isConfirmed || t.type !== 'expense') return false;
    const txDate = new Date(t.occurredAt);
    const now = new Date();
    return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
  });

  const dailySpends = Array.from({ length: currentDay }, (_, i) => {
    const day = i + 1;
    const spentOnDay = currentMonthTx
      .filter(t => new Date(t.occurredAt).getDate() === day)
      .reduce((sum, t) => sum + t.amount, 0);
    return spentOnDay;
  });

  let cumulative = 0;
  const cumulativeSpends = dailySpends.map(spend => {
    cumulative += spend;
    return cumulative;
  });

  const projectedSpend = currentDay > 0 ? (cumulative / currentDay) * daysInMonth : 0;
  const isOverBudget = projectedSpend > monthlyBudget;

  const width = 300;
  const height = 120;
  const padding = { top: 20, right: 10, bottom: 10, left: 10 };
  
  const effectiveWidth = width - padding.left - padding.right;
  const effectiveHeight = height - padding.top - padding.bottom;

  // We want the Y max to be either the budget or the projected spend, whichever is higher, plus some padding
  const maxY = Math.max(monthlyBudget, projectedSpend) * 1.1;
  const minY = 0;

  // Generate path points
  const points = cumulativeSpends.map((val, i) => {
    const x = padding.left + (i / Math.max(1, currentDay - 1)) * effectiveWidth;
    const y = padding.top + effectiveHeight - ((val - minY) / (maxY - minY)) * effectiveHeight;
    return { x, y, val, day: i + 1 };
  });

  const createPath = (pts: typeof points) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    
    return pts.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      // Smooth curve calculation
      const prev = arr[i - 1];
      const cx1 = prev.x + (pt.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (pt.x - prev.x) / 2;
      const cy2 = pt.y;
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
    }, '');
  };

  const pathD = createPath(points);
  
  // Area path (closed path for gradient fill)
  const areaD = points.length > 0 
    ? `${pathD} L ${points[points.length - 1].x} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`
    : '';

  useEffect(() => {
    if (!pathRef.current || !areaRef.current || points.length === 0) return;

    // Entrance animation
    const pathLength = pathRef.current.getTotalLength();
    
    gsap.set(pathRef.current, {
      strokeDasharray: pathLength,
      strokeDashoffset: pathLength,
      opacity: 1
    });

    gsap.set(areaRef.current, {
      opacity: 0,
      transformOrigin: 'bottom',
      scaleY: 0
    });

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.to(pathRef.current, {
      strokeDashoffset: 0,
      duration: 1.5,
    })
    .to(areaRef.current, {
      opacity: 1,
      scaleY: 1,
      duration: 1,
    }, '-=1');

    return () => {
      tl.kill();
    };
  }, [pathD, points.length]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (points.length === 0 || !containerRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Find closest point
    let closest = 0;
    let minDistance = Infinity;
    
    points.forEach((pt, i) => {
      const dist = Math.abs(pt.x - x);
      if (dist < minDistance) {
        minDistance = dist;
        closest = i;
      }
    });

    setHoverIndex(closest);
    
    if (tooltipRef.current) {
      const pt = points[closest];
      gsap.to(tooltipRef.current, {
        x: pt.x,
        y: pt.y - 40,
        opacity: 1,
        duration: 0.2,
        ease: 'power2.out'
      });
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    if (tooltipRef.current) {
      gsap.to(tooltipRef.current, {
        opacity: 0,
        duration: 0.2
      });
    }
  };

  const formattedProjected = new Intl.NumberFormat(locale, { style: 'currency', currency }).format(projectedSpend);
  const formattedBudget = new Intl.NumberFormat(locale, { style: 'currency', currency }).format(monthlyBudget);

  return (
    <div className="w-full bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]" ref={containerRef}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-[14px] font-medium text-gray-500 mb-1 flex items-center">
            <Calendar size={14} className="mr-1.5" /> Month Projection
          </p>
          <div className="flex items-baseline space-x-2">
            <h3 className="text-[24px] font-bold text-gray-900 tracking-tight">{formattedProjected}</h3>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-full flex items-center text-[13px] font-bold ${isOverBudget ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
          {isOverBudget ? <TrendingUp size={16} className="mr-1.5" /> : <TrendingDown size={16} className="mr-1.5" />}
          {isOverBudget ? 'Over Budget' : 'Safe'}
        </div>
      </div>

      <div className="relative w-full h-[120px]">
        {/* Tooltip */}
        <div 
          ref={tooltipRef}
          className="absolute z-10 opacity-0 pointer-events-none -translate-x-1/2"
        >
          <div className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-xl shadow-lg flex flex-col items-center">
            <span>{hoverIndex !== null ? new Intl.NumberFormat(locale, { style: 'currency', currency }).format(points[hoverIndex].val) : ''}</span>
            <span className="text-zinc-400 text-xs">Day {hoverIndex !== null ? points[hoverIndex].day : ''}</span>
          </div>
          {/* Arrow */}
          <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-900 mx-auto" />
        </div>

        <svg 
          width="100%" 
          height="100%" 
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="overflow-visible"
        >
          <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={isOverBudget ? '#ef4444' : '#10b981'} />
              <stop offset="100%" stopColor={isOverBudget ? '#ef4444' : '#10b981'} />
            </linearGradient>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isOverBudget ? '#ef4444' : '#10b981'} stopOpacity="0.2" />
              <stop offset="100%" stopColor={isOverBudget ? '#ef4444' : '#10b981'} stopOpacity="0.0" />
            </linearGradient>
            
            {/* Dashed line pattern for budget */}
            <pattern id="dashPattern" width="10" height="10" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="5" y2="0" stroke="#9ca3af" strokeWidth="1" />
            </pattern>
          </defs>

          {/* Budget Line */}
          {monthlyBudget > 0 && (
            <line 
              x1={padding.left} 
              y1={padding.top + effectiveHeight - ((monthlyBudget - minY) / (maxY - minY)) * effectiveHeight} 
              x2={width - padding.right} 
              y2={padding.top + effectiveHeight - ((monthlyBudget - minY) / (maxY - minY)) * effectiveHeight} 
              stroke="url(#dashPattern)" 
              strokeWidth="1.5" 
            />
          )}

          <path
            ref={areaRef}
            d={areaD}
            fill="url(#areaGradient)"
          />
          <path
            ref={pathRef}
            d={pathD}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-sm"
          />

          {/* Hover indicator point */}
          {hoverIndex !== null && (
            <circle
              cx={points[hoverIndex].x}
              cy={points[hoverIndex].y}
              r="4"
              fill="white"
              stroke={isOverBudget ? '#ef4444' : '#10b981'}
              strokeWidth="2.5"
              className="pointer-events-none"
            />
          )}
        </svg>
      </div>
      
      <div className="mt-4 flex justify-between items-center text-[12px] font-medium text-gray-400">
        <span>Day 1</span>
        <span>Day {daysInMonth}</span>
      </div>
    </div>
  );
}
