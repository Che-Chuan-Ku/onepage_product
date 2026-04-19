package com.onepage.product.cucumber;

import org.junit.platform.suite.api.*;

@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features")
@ConfigurationParameter(key = "cucumber.plugin", value = "pretty, html:target/cucumber-reports/report.html")
@ConfigurationParameter(key = "cucumber.glue", value = "com.onepage.product.steps,com.onepage.product.cucumber")
@ConfigurationParameter(key = "cucumber.filter.tags", value = "not @ignore")
public class CucumberTestSuite {
}
