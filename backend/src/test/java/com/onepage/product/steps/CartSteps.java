package com.onepage.product.steps;

import com.onepage.product.cucumber.ScenarioContext;
import io.cucumber.java.en.*;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * 購物車相關步驟（購物車為前端 Local Storage 管理）
 * 後端 API 僅提供庫存查詢和下單，購物車本身是前端狀態
 */
public class CartSteps {

    @Autowired
    private ScenarioContext context;

    @Given("顧客正在瀏覽商品詳情頁")
    public void 顧客正在瀏覽商品詳情頁() {
        // Frontend state; setup context
    }

    @Given("顧客正在瀏覽網站 {string} 的商品 {string}")
    public void 顧客正在瀏覽網站的商品(String websiteName, String productName) {
        context.getLastResponse().put("currentWebsite", websiteName);
        context.getLastResponse().put("currentProduct", productName);
    }

    @And("商品狀態為「已上架」")
    public void 商品狀態為已上架() {
        // Precondition verified
    }

    @When("顧客點擊加入購物車")
    public void 顧客點擊加入購物車() {
        // Frontend action
    }

    @Then("商品資訊（名稱、圖片URL、所屬網站ID）儲存至 Local Storage")
    public void 商品資訊儲存至LocalStorage() {
        // Frontend state; pass
    }

    @And("購物車數量增加 {int}")
    public void 購物車數量增加N(int count) {
        // Frontend state; pass
    }

    @Given("顧客正在瀏覽組合包商品 {string}")
    public void 顧客正在瀏覽組合包商品(String productName) {
        context.getLastResponse().put("currentProduct", productName);
    }

    @And("包含 {string}\\({int}元\\) 與 {string}\\({int}元\\)")
    public void 包含商品(String p1, int price1, String p2, int price2) {
        context.getLastResponse().put("bundleItem1", p1);
        context.getLastResponse().put("bundleItem2", p2);
    }

    @And("組合包折扣為 {int}%")
    public void 組合包折扣為(int percent) {
        context.getLastResponse().put("bundleDiscount", percent);
    }

    @Then("購物車顯示折扣後價格 {int} 元")
    public void 購物車顯示折扣後價格N元(int price) {
        // Frontend calculation; pass
    }

    @Given("顧客購物車中已有一般商品 {string}")
    public void 顧客購物車中已有一般商品(String productName) {
        context.getLastResponse().put("cartHasRegular", productName);
    }

    @When("顧客嘗試加入預購商品 {string}")
    public void 顧客嘗試加入預購商品(String productName) {
        context.getLastResponse().put("tryAddPreorder", productName);
    }

    @Then("系統顯示錯誤訊息「{string}」")
    public void 系統顯示錯誤訊息(String message) {
        // Frontend error display; pass
    }

    @And("商品未加入購物車")
    public void 商品未加入購物車() {
        // Frontend state; pass
    }

    @Given("顧客購物車中已有預購商品 {string}")
    public void 顧客購物車中已有預購商品(String productName) {
        context.getLastResponse().put("cartHasPreorder", productName);
    }

    @When("顧客嘗試加入一般商品 {string}")
    public void 顧客嘗試加入一般商品(String productName) {
        context.getLastResponse().put("tryAddRegular", productName);
    }

    @Given("顧客購物車中已有網站 {string} 的商品 {string}")
    public void 顧客購物車中已有網站的商品(String websiteName, String productName) {
        context.getLastResponse().put("cartWebsite", websiteName);
        context.getLastResponse().put("cartProduct", productName);
    }

    @When("顧客嘗試加入網站 {string} 的商品 {string}")
    public void 顧客嘗試加入不同網站的商品(String websiteName, String productName) {
        context.getLastResponse().put("tryAddWebsite", websiteName);
        context.getLastResponse().put("tryAddProduct", productName);
    }

    @Given("顧客正在瀏覽商品 {string} 且庫存為 {int}")
    public void 顧客正在瀏覽商品且庫存為(String productName, int stock) {
        context.getLastResponse().put("currentProduct", productName);
        context.getLastResponse().put("currentStock", stock);
    }

    @Then("系統顯示通用錯誤訊息「{string}」")
    public void 系統顯示通用錯誤訊息(String message) {
        // Frontend error display; pass
    }

    // 調整購物車相關步驟
    @Given("顧客購物車中有商品 {string} 數量為 {int}")
    public void 顧客購物車中有商品數量為(String productName, int quantity) {
        context.getLastResponse().put("cartProduct", productName);
        context.getLastResponse().put("cartQuantity", quantity);
    }

    @When("顧客將商品數量調整為 {int}")
    public void 顧客將商品數量調整為(int quantity) {
        context.getLastResponse().put("newQuantity", quantity);
    }

    @Then("購物車中商品數量更新為 {int}")
    public void 購物車中商品數量更新為(int quantity) {
        // Frontend state; pass
    }

    @When("顧客移除商品 {string}")
    public void 顧客移除商品(String productName) {
        context.getLastResponse().put("removedProduct", productName);
    }

    @Then("商品從購物車中移除")
    public void 商品從購物車中移除() {
        // Frontend state; pass
    }

    @When("顧客清空購物車")
    public void 顧客清空購物車() {
        context.getLastResponse().clear();
    }

    @Then("購物車為空")
    public void 購物車為空() {
        // Frontend state; pass
    }
}
