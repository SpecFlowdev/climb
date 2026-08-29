import { useMemo, useState } from 'react';
import type { MoneyMap } from '../api';

/**
 * Radial money map.
 *
 * The centre is the period's total; the first ring is categories, the outer
 * ring the counterparties inside each of them. Angular space is allocated by
 * amount (with a floor so small categories stay clickable), link thickness is
 * proportional to the amount flowing through it, and labels are rotated along
 * their own radius — which is what keeps them from ever colliding.
 */

const VIEW_W = 920;
const VIEW_H = 680;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;
const R_BRANCH = 196;
const R_LEAF = 292;
const SLICE_GAP = 0.045;
const MIN_SHARE = 0.05;

interface Point {
  x: number;
  y: number;
}

const polar = (radius: number, angle: number): Point => ({
  x: CX + radius * Math.cos(angle),
  y: CY + radius * Math.sin(angle),
});

/** Smooth radial link: control points sit at the midpoint radius of each end. */
function radialLink(r1: number, a1: number, r2: number, a2: number): string {
  const from = polar(r1, a1);
  const to = polar(r2, a2);
  const mid = (r1 + r2) / 2;
  const c1 = polar(mid, a1);
  const c2 = polar(mid, a2);
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
}

/**
 * Leaf labels sit outward along their own angle — there is room out there and
 * nothing to collide with.
 */
function leafLabelAt(radius: number, angle: number) {
  const point = polar(radius, angle);
  const cos = Math.cos(angle);
  const vertical = Math.abs(cos) < 0.34;
  const anchor = vertical ? ('middle' as const) : cos > 0 ? ('start' as const) : ('end' as const);
  return {
    x: point.x + (vertical ? 0 : cos > 0 ? 9 : -9),
    y: point.y + (vertical ? (Math.sin(angle) > 0 ? 17 : -11) : 0),
    anchor,
  };
}

/**
 * Branch labels sit above or below their node rather than further out along the
 * radius: the radius is where that branch's own links to its leaves run, and a
 * label placed there lands right on top of them.
 */
function branchLabelAt(point: Point, nodeRadius: number, angle: number) {
  const below = Math.sin(angle) > 0;
  return {
    x: point.x,
    y: point.y + (below ? nodeRadius + 20 : -(nodeRadius + 14)),
    anchor: 'middle' as const,
  };
}

interface LaidOutLeaf {
  id: string;
  label: string;
  value: number;
  count: number;
  angle: number;
  radius: number;
  isOther: boolean;
}

interface LaidOutBranch {
  id: string;
  categoryId: number | null;
  label: string;
  color: string;
  value: number;
  count: number;
  share: number;
  angle: number;
  radius: number;
  linkWidth: number;
  leaves: LaidOutLeaf[];
}

export function MoneyMapChart({
  data,
  labelFor,
  formatValue,
  onSelectBranch,
  onSelectLeaf,
  centerLabel,
}: {
  data: MoneyMap;
  labelFor: (branch: MoneyMap['branches'][number]) => string;
  formatValue: (value: number) => string;
  onSelectBranch?: (branch: MoneyMap['branches'][number]) => void;
  onSelectLeaf?: (leaf: { label: string }) => void;
  centerLabel: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const branches = useMemo<LaidOutBranch[]>(() => {
    const source = data.branches.filter((branch) => branch.value > 0);
    if (source.length === 0) return [];

    const total = source.reduce((sum, branch) => sum + branch.value, 0);
    const maxValue = Math.max(...source.map((branch) => branch.value));

    // Proportional angles, but nothing narrower than MIN_SHARE of the circle.
    const rawWeights = source.map((branch) => Math.max(branch.value / total, MIN_SHARE));
    const weightSum = rawWeights.reduce((sum, weight) => sum + weight, 0);
    const usable = Math.PI * 2 - SLICE_GAP * source.length;

    let cursor = -Math.PI / 2 - SLICE_GAP / 2;

    return source.map((branch, index) => {
      const span = (rawWeights[index] / weightSum) * usable;
      const start = cursor + SLICE_GAP / 2;
      const angle = start + span / 2;
      cursor = start + span + SLICE_GAP / 2;

      const leafMax = Math.max(...branch.children.map((leaf) => leaf.value), 1);
      const inner = span * 0.78;
      const leaves = branch.children.map((leaf, leafIndex) => {
        const ratio =
          branch.children.length === 1
            ? 0.5
            : leafIndex / (branch.children.length - 1);
        return {
          id: leaf.id,
          label: leaf.label,
          value: leaf.value,
          count: leaf.count,
          isOther: leaf.isOther,
          angle: angle - inner / 2 + inner * ratio,
          radius: 3.5 + 7 * Math.sqrt(leaf.value / leafMax),
        };
      });

      return {
        id: branch.id,
        categoryId: branch.categoryId,
        label: labelFor(branch),
        color: branch.color,
        value: branch.value,
        count: branch.count,
        share: branch.share,
        angle,
        radius: 11 + 17 * Math.sqrt(branch.value / maxValue),
        linkWidth: 3 + 18 * (branch.value / maxValue),
        leaves,
      };
    });
  }, [data, labelFor]);

  if (branches.length === 0) return null;

  const dimmed = (id: string) => hovered !== null && hovered !== id;

  return (
    <div className="moneymap">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={centerLabel}>
        <defs>
          {branches.map((branch) => (
            <linearGradient
              key={branch.id}
              id={`mm-${branch.id.replace(/[^a-z0-9]/gi, '')}`}
              gradientUnits="userSpaceOnUse"
              x1={CX}
              y1={CY}
              x2={polar(R_BRANCH, branch.angle).x}
              y2={polar(R_BRANCH, branch.angle).y}
            >
              <stop offset="0%" stopColor={branch.color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={branch.color} stopOpacity="0.85" />
            </linearGradient>
          ))}
        </defs>

        {/* Guide rings give the eye a sense of the two levels. */}
        <circle cx={CX} cy={CY} r={R_BRANCH} className="mm-ring" />
        <circle cx={CX} cy={CY} r={R_LEAF} className="mm-ring faint" />

        {branches.map((branch) => {
          const gradientId = `mm-${branch.id.replace(/[^a-z0-9]/gi, '')}`;
          const branchPoint = polar(R_BRANCH, branch.angle);
          const label = branchLabelAt(branchPoint, branch.radius, branch.angle);

          return (
            <g
              key={branch.id}
              className={`mm-branch ${dimmed(branch.id) ? 'dim' : ''}`}
              onMouseEnter={() => setHovered(branch.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => {
                const original = data.branches.find((item) => item.id === branch.id);
                if (original && onSelectBranch) onSelectBranch(original);
              }}
            >
              {/* A wide transparent copy of the link makes the whole branch
                  easy to hover and click, not just its drawn stroke. */}
              <path
                className="mm-hit"
                d={radialLink(28, branch.angle, R_BRANCH + branch.radius, branch.angle)}
                strokeWidth={Math.max(branch.linkWidth + 26, 34)}
                fill="none"
                strokeLinecap="round"
              />
              <path
                d={radialLink(28, branch.angle, R_BRANCH - branch.radius, branch.angle)}
                stroke={`url(#${gradientId})`}
                strokeWidth={branch.linkWidth}
                fill="none"
                strokeLinecap="round"
                pointerEvents="none"
              />

              {branch.leaves.map((leaf) => (
                <g key={leaf.id} className="mm-leaf">
                  <path
                    d={radialLink(
                      R_BRANCH + branch.radius,
                      branch.angle,
                      R_LEAF - leaf.radius,
                      leaf.angle,
                    )}
                    stroke={branch.color}
                    strokeOpacity={leaf.isOther ? 0.25 : 0.45}
                    strokeWidth={1.2 + 5 * (leaf.value / Math.max(branch.value, 1))}
                    fill="none"
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                  <circle
                    className="mm-hit-dot"
                    cx={polar(R_LEAF, leaf.angle).x}
                    cy={polar(R_LEAF, leaf.angle).y}
                    r={Math.max(leaf.radius + 12, 16)}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!leaf.isOther && onSelectLeaf) onSelectLeaf(leaf);
                    }}
                  />
                  <circle
                    cx={polar(R_LEAF, leaf.angle).x}
                    cy={polar(R_LEAF, leaf.angle).y}
                    r={leaf.radius}
                    fill={branch.color}
                    fillOpacity={leaf.isOther ? 0.4 : 0.9}
                    pointerEvents="none"
                  />
                  {(() => {
                    const leafLabel = leafLabelAt(R_LEAF + leaf.radius + 6, leaf.angle);
                    return (
                      <text
                        className="mm-leaf-label"
                        pointerEvents="none"
                        x={leafLabel.x}
                        y={leafLabel.y}
                        textAnchor={leafLabel.anchor}
                        dy="0.32em"
                      >
                        {leaf.label.length > 20 ? `${leaf.label.slice(0, 19)}…` : leaf.label}
                      </text>
                    );
                  })()}
                </g>
              ))}

              <circle
                cx={branchPoint.x}
                cy={branchPoint.y}
                r={branch.radius}
                fill={branch.color}
                className="mm-node"
                pointerEvents="none"
              />
              <text
                x={branchPoint.x}
                y={branchPoint.y}
                textAnchor="middle"
                dy="0.34em"
                className="mm-node-value"
              >
                {branch.share >= 8 ? `${Math.round(branch.share)}%` : ''}
              </text>

              <text
                className="mm-branch-label"
                pointerEvents="none"
                x={label.x}
                y={label.y}
                textAnchor={label.anchor}
                dy="-0.15em"
              >
                {branch.label}
              </text>
              <text
                className="mm-branch-value"
                pointerEvents="none"
                x={label.x}
                y={label.y}
                textAnchor={label.anchor}
                dy="1.15em"
              >
                {formatValue(branch.value)}
              </text>
            </g>
          );
        })}

        <circle cx={CX} cy={CY} r={74} className="mm-hub" />
        <text x={CX} y={CY} textAnchor="middle" dy="-0.6em" className="mm-hub-label">
          {centerLabel}
        </text>
        <text x={CX} y={CY} textAnchor="middle" dy="0.85em" className="mm-hub-value">
          {formatValue(data.total)}
        </text>
      </svg>
    </div>
  );
}
