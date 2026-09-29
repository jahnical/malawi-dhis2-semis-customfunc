/** Signed count of complete calendar months, ignoring time zones and time of day. */
export function monthsBetween(first: string, second: string): number {
    const parse = (value: string) => {
        const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
        if (!match) return undefined;
        const [year, month, day] = match.slice(1).map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
            ? { year, month, day, time: date.getTime() } : undefined;
    };
    const start = parse(first), end = parse(second);
    if (!start || !end) return NaN;
    const forward = end.time >= start.time;
    const earlier = forward ? start : end, later = forward ? end : start;
    const months = (later.year - earlier.year) * 12 + later.month - earlier.month - (later.day < earlier.day ? 1 : 0);
    return months === 0 ? 0 : (forward ? months : -months);
}
