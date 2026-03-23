export function CardSkeleton() {
  return (
    <div className="border border-outline bg-surface-low p-8 animate-pulse-slow">
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="h-3 w-16 bg-outline mb-3" />
          <div className="h-6 w-40 bg-outline mb-2" />
          <div className="h-3 w-24 bg-[#e2e3e7]" />
        </div>
        <div className="text-right">
          <div className="h-3 w-8 bg-[#e2e3e7] mb-2" />
          <div className="h-8 w-16 bg-outline" />
        </div>
      </div>
      <div className="pt-4 border-t border-outline-variant">
        <div className="flex gap-6">
          <div className="h-3 w-20 bg-[#e2e3e7]" />
          <div className="h-3 w-20 bg-[#e2e3e7]" />
        </div>
      </div>
    </div>
  );
}

export function AnalysisSkeleton() {
  return (
    <div className="space-y-8 animate-pulse-slow">
      <div className="flex items-center gap-6 mb-8">
        <div className="w-20 h-20 bg-outline" />
        <div>
          <div className="h-5 w-36 bg-outline mb-3" />
          <div className="h-3 w-48 bg-[#e2e3e7]" />
        </div>
      </div>
      <div className="border border-outline bg-surface-low p-8">
        <div className="h-4 w-full bg-[#e2e3e7] mb-3" />
        <div className="h-4 w-3/4 bg-[#e2e3e7] mb-3" />
        <div className="h-4 w-1/2 bg-[#e2e3e7]" />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(count)].map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
