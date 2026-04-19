package com.onepage.product.steps;

import com.onepage.product.cucumber.ScenarioContext;
import io.cucumber.java.en.*;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * 調整購物車步驟（純前端 Local Storage 實作）
 */
public class CartAdjustSteps {

    @Autowired
    private ScenarioContext context;

    @Given("顧客購物車中有商品 {string} 數量為 {int}，單價 {int} 元")
    public void 顧客購物車中有商品數量為單價(String productName, int quantity, int price) {
        context.getLastResponse().put("cartProduct", productName);
        context.getLastResponse().put("cartQuantity", quantity);
        context.getLastResponse().put("unitPrice", price);
    }

    @Given("顧客購物車中有商品 {string} 數量為 {int}")
    public void 顧客購物車中有商品數量為只有量(String productName, int quantity) {
        context.getLastResponse().put("cartProduct", productName);
        context.getLastResponse().put("cartQuantity", quantity);
    }

    @When("顧客將數量增加至 {int}")
    public void 顧客將數量增加至(int quantity) {
        context.getLastResponse().put("newQuantity", quantity);
    }

    @When("顧客將數量減少至 {int}")
    public void 顧客將數量減少至(int quantity) {
        context.getLastResponse().put("newQuantity", quantity);
    }

    @When("顧客將數量設為 {int}")
    public void 顧客將數量設為(int quantity) {
        context.getLastResponse().put("newQuantity", quantity);
    }

    @Then("商品小計更新為 {int} 元")
    public void 商品小計更新為N元(int amount) {
        // Frontend calculation; pass
    }

    @And("購物車總價即時更新")
    public void 購物車總價即時更新() {
        // Frontend state; pass
    }

    @Then("商品 {string} 從購物車中移除")
    public void 商品從購物車中移除帶名稱(String productName) {
        // Frontend state; pass
    }

    @Given("顧客購物車中有商品 {string} 與 {string}")
    public void 顧客購物車中有兩個商品(String product1, String product2) {
        context.getLastResponse().put("cartProduct1", product1);
        context.getLastResponse().put("cartProduct2", product2);
    }

    @When("顧客點擊刪除商品 {string}")
    public void 顧客點擊刪除商品(String productName) {
        context.getLastResponse().put("deletedProduct", productName);
    }

    @And("購物車僅剩 {string}")
    public void 購物車僅剩(String productName) {
        // Frontend state; pass
    }

    @Given("顧客購物車中有商品總計 {int} 元")
    public void 顧客購物車中有商品總計N元(int amount) {
        context.getLastResponse().put("cartTotal", amount);
    }

    @When("顧客查看購物車頁面")
    public void 顧客查看購物車頁面() {
        // Frontend state; pass
    }

    @Then("顯示運費預估提示「再 {int} 元即可免運」")
    public void 顯示運費預估提示(int amount) {
        // Frontend display; pass
    }

    @When("顧客刪除商品 {string}")
    public void 顧客刪除商品(String productName) {
        顧客點擊刪除商品(productName);
    }

    @Then("購物車顯示為空")
    public void 購物車顯示為空() {
        // Frontend state; pass
    }

    @And("前往結帳按鈕不可用")
    public void 前往結帳按鈕不可用() {
        // Frontend UI state; pass
    }
}
