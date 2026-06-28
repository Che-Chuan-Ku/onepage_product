package com.gomoku.web;

import java.util.List;

/**
 * ManagePageResponse payload: {items, totalCount}.
 */
public class PageData<T> {

    private List<T> items;
    private long totalCount;

    public PageData() {
    }

    public PageData(List<T> items, long totalCount) {
        this.items = items;
        this.totalCount = totalCount;
    }

    public List<T> getItems() { return items; }
    public void setItems(List<T> items) { this.items = items; }

    public long getTotalCount() { return totalCount; }
    public void setTotalCount(long totalCount) { this.totalCount = totalCount; }
}
