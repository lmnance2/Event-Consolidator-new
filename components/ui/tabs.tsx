"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

import { cn } from "@/lib/utils"

function TabsRoot({
  className,
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "relative flex gap-6 overflow-x-auto snap-x border-b border-border",
        "scrollbar-none",
        className
      )}
      {...props}
    />
  )
}

function TabsTab({
  className,
  ...props
}: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(
        "relative shrink-0 snap-start pb-3 pt-1 text-sm text-muted-foreground",
        "font-normal transition-colors duration-150",
        "hover:text-foreground",
        "data-active:text-foreground data-active:font-medium",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
        "cursor-pointer select-none",
        className
      )}
      {...props}
    />
  )
}

function TabsIndicator({
  className,
  ...props
}: TabsPrimitive.Indicator.Props) {
  return (
    <TabsPrimitive.Indicator
      data-slot="tabs-indicator"
      className={cn(
        "absolute bottom-0 h-0.5 bg-foreground",
        "transition-all duration-200 ease-out",
        "motion-reduce:transition-none",
        className
      )}
      {...props}
    />
  )
}

function TabsPanel({
  className,
  ...props
}: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      tabIndex={0}
      className={cn("outline-none", className)}
      {...props}
    />
  )
}

export { TabsRoot, TabsList, TabsTab, TabsIndicator, TabsPanel }
