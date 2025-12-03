"use client";

import { useEffect, useState } from "react";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function format(date: Date) {
  const now = new Date();
  const diff = (date.getTime() - now.getTime()) / 1000;

  const units = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ] as const;

  for (const [unit, seconds] of units) {
    if (Math.abs(diff) >= seconds || unit === "second") {
      return rtf.format(
        Math.round(diff / seconds),
        unit as Intl.RelativeTimeFormatUnit,
      );
    }
  }
}

export default function TimeAgo({ dateString }: { dateString: string }) {
  const date = new Date(dateString);
  const [text, setText] = useState(() => format(date));

  useEffect(() => {
    const update = () => setText(format(date));
    update();

    // update every 30 seconds (cheap + good enough)
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [dateString]);

  return <span title={date.toISOString()}>{text}</span>;
}
