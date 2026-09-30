"use client";

import type { Point } from "@/lib/homography";
import type { StageView } from "./PhotoStage";
import Handle from "./Handle";

interface CalibrationRulerProps {
    a: Point;
    b: Point;
    onChange: (a: Point, b: Point) => void;
    view: StageView;
    photo: { url: string; width: number; height: number };
    /** Tekst na środku linii, np. "80 cm" */
    label: string;
}

/** Linijka do ustawienia skali: klient przeciąga końce do krawędzi przedmiotu o znanym wymiarze. */
export default function CalibrationRuler({ a, b, onChange, view, photo, label }: CalibrationRulerProps) {
    const s = view.scale;
    const ax = a.x * s;
    const ay = a.y * s;
    const bx = b.x * s;
    const by = b.y * s;
    const angle = Math.atan2(by - ay, bx - ax);
    // Krótkie poprzeczne kreski na końcach, jak na miarce
    const tick = (x: number, y: number) => {
        const nx = -Math.sin(angle) * 10;
        const ny = Math.cos(angle) * 10;
        return <line x1={x - nx} y1={y - ny} x2={x + nx} y2={y + ny} />;
    };

    return (
        <>
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10" aria-hidden>
                <g stroke="rgba(0,0,0,0.55)" strokeWidth={5} strokeLinecap="round">
                    <line x1={ax} y1={ay} x2={bx} y2={by} />
                    {tick(ax, ay)}
                    {tick(bx, by)}
                </g>
                <g stroke="#fff" strokeWidth={2} strokeLinecap="round">
                    <line x1={ax} y1={ay} x2={bx} y2={by} strokeDasharray="6 5" />
                    {tick(ax, ay)}
                    {tick(bx, by)}
                </g>
            </svg>

            <div
                className="absolute -translate-x-1/2 -translate-y-[150%] pointer-events-none z-10
                           bg-white text-black text-xs font-bold px-2.5 py-1 rounded-full shadow-lg whitespace-nowrap"
                style={{ left: (ax + bx) / 2, top: (ay + by) / 2 }}
            >
                {label}
            </div>

            <Handle
                ariaLabel="Początek miarki"
                point={a}
                view={view}
                photo={photo}
                onChange={(p) => onChange(p, b)}
            />
            <Handle
                ariaLabel="Koniec miarki"
                point={b}
                view={view}
                photo={photo}
                onChange={(p) => onChange(a, p)}
            />
        </>
    );
}
