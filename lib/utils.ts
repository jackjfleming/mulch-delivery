// Instead of importing clsx directly, we'll create a simpler implementation
// that provides the same functionality for class name conditionals
function clsx(...inputs: any[]) {
  return inputs
    .flatMap((input) => {
      if (input === false || input === null || input === undefined) return []
      if (typeof input === "string" || typeof input === "number") return input
      if (Array.isArray(input)) return input.flatMap((i) => clsx(i))
      if (typeof input === "object") {
        return Object.entries(input)
          .filter(([, value]) => Boolean(value))
          .map(([key]) => key)
      }
      return []
    })
    .filter(Boolean)
    .join(" ")
}

// Simple implementation of tailwind-merge functionality
// This is a simplified version that just concatenates classes
function twMerge(...inputs: string[]) {
  return inputs.filter(Boolean).join(" ")
}

export type ClassValue = string | number | boolean | undefined | null | Record<string, boolean> | ClassValue[]

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatProductName(name: string): string {
  if (!name) return name

  const lowerName = name.toLowerCase()

  if (lowerName.includes("red mulch")) {
    return `🔴 ${name}`
  } else if (lowerName.includes("black mulch")) {
    return `⚫ ${name}`
  } else if (lowerName.includes("cedar mulch")) {
    return `🟠 ${name}`
  } else if (lowerName.includes("hardwood mulch")) {
    return `🪵 ${name}`
  } else if (lowerName.includes("manure")) {
    return `💩 ${name}`
  } else if (lowerName.includes("top soil")) {
    return `🌱 ${name}`
  }

  return name
}
