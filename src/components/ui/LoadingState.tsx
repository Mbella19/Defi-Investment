export function CardSkeleton() {
  return (
    <div className="bg-surface-low ghost-border p-8 animate-pulse-slow">
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="h-4 w-16 bg-surface-highest mb-2" />
          <div className="h-6 w-40 bg-surface-highest mb-1" />
          <div className="h-3 w-24 bg-surface-high" />
        </div>
        <div className="text-right">
          <div className="h-3 w-8 bg-surface-high mb-1" />
          <div className="h-8 w-16 bg-surface-highest" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div>
          <div className="h-3 w-16 bg-surface-high mb-1" />
          <div className="h-4 w-20 bg-surface-highest" />
        </div>
        <div>
          <div className="h-3 w-16 bg-surface-high mb-1" />
          <div className="h-4 w-20 bg-surface-highest" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 h-10 bg-surface-highest" />
        <div className="w-12 h-10 bg-surface-high" />
      </div>
    </div>
  );
}

export function AnalysisSkeleton() {
  return (
    <div className="space-y-8 animate-pulse-slow">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-24 h-24 bg-surface-highest" />
        <div>
          <div className="h-4 w-32 bg-surface-highest mb-2" />
          <div className="h-3 w-48 bg-surface-high" />
        </div>
      </div>
      <div className="bg-surface-lowest p-8 border-l-4 border-primary/30">
        <div className="h-4 w-full bg-surface-high mb-2" />
        <div className="h-4 w-3/4 bg-surface-high mb-2" />
        <div className="h-4 w-1/2 bg-surface-high" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-surface-low ghost-border p-6">
            <div className="h-4 w-24 bg-surface-highest mb-4" />
            <div className="h-3 w-full bg-surface-high mb-2" />
            <div className="h-3 w-3/4 bg-surface-high mb-2" />
            <div className="h-3 w-1/2 bg-surface-high" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-surface">
      {[...Array(count)].map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
