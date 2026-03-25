import React, { useEffect, useRef, useState, useCallback } from "react";

const InfiniteScrollFeed = ({ fetchData, renderItem }) => {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const observer = useRef(null);
  const isFetching = useRef(false); // 🔹 prevents duplicate calls

  const loadMore = useCallback(async () => {
    if (isFetching.current || !hasMore) return;

    isFetching.current = true;
    setLoading(true);

    try {
      const result = await fetchData(page);

      if (!result || result.length === 0) {
        setHasMore(false);
      } else {
        setItems((prev) => [...prev, ...result]);
        setPage((prev) => prev + 1);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [fetchData, page, hasMore]);

  const lastElementRef = useCallback(
    (node) => {
      if (loading) return;

      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      });

      if (node) observer.current.observe(node);
    },
    [loading, hasMore, loadMore]
  );

  // Initial load
  useEffect(() => {
    loadMore();
  }, []);

  return (
    <div>
      {items.map((item, index) => {
        if (index === items.length - 1) {
          return (
            <div ref={lastElementRef} key={index}>
              {renderItem(item)}
            </div>
          );
        }
        return <div key={index}>{renderItem(item)}</div>;
      })}

      {loading && (
        <div style={styles.loader}>
          <p>Loading more...</p>
        </div>
      )}

      {!hasMore && (
        <div style={styles.end}>
          <p>No more items</p>
        </div>
      )}
    </div>
  );
};

const styles = {
  loader: {
    textAlign: "center",
    padding: "20px",
  },
  end: {
    textAlign: "center",
    padding: "20px",
    opacity: 0.6,
  },
};

export default InfiniteScrollFeed;