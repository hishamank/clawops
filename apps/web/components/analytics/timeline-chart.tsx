"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TimelinePoint {
  timestamp: string;
  value: number;
  label?: string;
}

interface TimelineChartProps {
  data: TimelinePoint[];
  title: string;
  color?: string;
  formatValue?: (value: number) => string;
}

const CHART_HEIGHT = 200;
const CHART_PADDING = { top: 20, right: 20, bottom: 30, left: 50 };

export function TimelineChart({
  data,
  title,
  color = "hsl(var(--primary))",
  formatValue = (v) => v.toLocaleString(),
}: TimelineChartProps): React.JSX.Element {
  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const values = data.map((d) => d.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;

    const width = 600;
    const height = CHART_HEIGHT;
    const innerWidth = width - CHART_PADDING.left - CHART_PADDING.right;
    const innerHeight = height - CHART_PADDING.top - CHART_PADDING.bottom;

    const points = data.map((d, i) => {
      const x = data.length > 1 ? CHART_PADDING.left + (i / (data.length - 1)) * innerWidth : CHART_PADDING.left + innerWidth / 2;
      const y =
        CHART_PADDING.top +
        innerHeight -
        ((d.value - minValue) / range) * innerHeight;
      return { x, y, ...d };
    });

    const pathD = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");

    const areaD = `${pathD} L ${points[points.length - 1].x} ${CHART_PADDING.top + innerHeight} L ${points[0].x} ${CHART_PADDING.top + innerHeight} Z`;

    const xLabels = points.filter((_, i) => {
      const step = Math.ceil(points.length / 5);
      return i % step === 0 || i === points.length - 1;
    });

    const yTicks = 4;
    const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
      const value = minValue + (range * i) / yTicks;
      const y = CHART_PADDING.top + innerHeight - (i / yTicks) * innerHeight;
      return { value, y };
    });

    return { points, pathD, areaD, xLabels, yLabels, innerWidth, innerHeight };
  }, [data]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground py-8">
            No data available for this time range.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <svg
            viewBox="0 0 600 200"
            className="w-full h-auto"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Grid lines */}
            {chartData!.yLabels.map((tick, i) => (
              <g key={i}>
                <line
                  x1={CHART_PADDING.left}
                  y1={tick.y}
                  x2={600 - CHART_PADDING.right}
                  y2={tick.y}
                  stroke="hsl(var(--muted))"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={CHART_PADDING.left - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px]"
                >
                  {formatValue(tick.value)}
                </text>
              </g>
            ))}

            {/* Area fill */}
            <path
              d={chartData!.areaD}
              fill={color}
              fillOpacity="0.1"
              stroke="none"
            />

            {/* Line */}
            <path
              d={chartData!.pathD}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points */}
            {chartData!.points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r="3"
                fill={color}
                className="opacity-0 hover:opacity-100 transition-opacity"
              />
            ))}

            {/* X-axis labels */}
            {chartData!.xLabels.map((label, i) => (
              <text
                key={i}
                x={label.x}
                y={CHART_PADDING.top + chartData!.innerHeight + 20}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {label.timestamp}
              </text>
            ))}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
