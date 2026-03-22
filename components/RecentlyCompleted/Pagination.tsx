interface PaginationProps {
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  setCurrentPage,
}: PaginationProps) {
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2 mt-auto">
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={handlePrevPage}
          disabled={currentPage === 1}
          aria-label="Previous page"
          className={`p-2.5 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-warm-peach focus:ring-offset-2 focus:ring-offset-warm-card ${
            currentPage === 1
              ? 'text-warm-gray/50 cursor-not-allowed'
              : 'text-warm-peach hover:bg-warm-peach/10 hover:text-warm-peach'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <div className="px-3 py-1 rounded-lg bg-warm-card/50 text-sm border border-warm-border">
          <span className="text-warm-gray">Page {currentPage} of {totalPages}</span>
        </div>

        <button
          type="button"
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
          aria-label="Next page"
          className={`p-2.5 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-warm-peach focus:ring-offset-2 focus:ring-offset-warm-card ${
            currentPage === totalPages
              ? 'text-warm-gray/50 cursor-not-allowed'
              : 'text-warm-peach hover:bg-warm-peach/10 hover:text-warm-peach'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
