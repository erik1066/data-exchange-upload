import dex.DexUploadClient
import org.testng.Assert
import org.testng.ITestContext
import org.testng.TestNGException
import org.testng.annotations.*
import tus.UploadClient
import util.*
import util.DataProvider
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.time.ZonedDateTime
import java.util.TimeZone

@Listeners(UploadIdTestListener::class)
@Test
class FileCopy {
    private val testFile = TestFile.getResourceFile("10KB-test-file")
    private val dexUploadClient = DexUploadClient(EnvConfig.UPLOAD_URL)
    private lateinit var authToken: String
    private lateinit var testContext: ITestContext
    private lateinit var uploadClient: UploadClient

    @BeforeTest(groups = [Constants.Groups.FILE_COPY])
    fun beforeFileCopy() {
        authToken = dexUploadClient.getToken(EnvConfig.SAMS_USERNAME, EnvConfig.SAMS_PASSWORD)
    }

    @BeforeMethod
    fun setupUpload(context: ITestContext) {
        testContext = context
        uploadClient = UploadClient(EnvConfig.UPLOAD_URL, authToken)
    }

    @Test(
        groups = [Constants.Groups.FILE_COPY],
        dataProvider = "validManifestProvider",
        dataProviderClass = DataProvider::class
    )
    fun shouldUploadFile(case: TestCase) {
        val uid = uploadClient.uploadFile(testFile, case.manifest)
            ?: throw TestNGException("Error uploading file ${testFile.name}")
        testContext.setAttribute("uploadId", uid)
        Thread.sleep(5000)
        val uploadInfo = dexUploadClient.getFileInfo(uid, authToken)

        // Check File Info
        val expectedBytes: Long = 10240
        Assert.assertEquals(uploadInfo.fileInfo.sizeBytes, expectedBytes)

        // Check Upload Status
        Assert.assertEquals(uploadInfo.uploadStatus.status, "Complete", "File upload status is not 'Complete'")

        // Check Deliveries
        Assert.assertEquals(uploadInfo.deliveries?.size, case.deliveryTargets?.size, "Expected ${case.deliveryTargets?.size ?: 0 } deliveries")

        val expectedDeliveryNames = case.deliveryTargets?.map{ it.name }?.sorted()
        val actualDeliveryNames = uploadInfo.deliveries?.map{ it.name }?.sorted()
        Assert.assertEquals(actualDeliveryNames, expectedDeliveryNames, "Actual delivery targets do not match expected targets")

        val currentDateTime = ZonedDateTime.now(TimeZone.getTimeZone("GMT").toZoneId())
        uploadInfo.deliveries?.forEach { delivery ->
            Assert.assertEquals(delivery.status, "SUCCESS") 
            val encodedLocation = delivery.location.replace("+", "%2B")  // encode the + symbol in the location to properly decode it below
            val actualLocation = URLDecoder.decode(encodedLocation, StandardCharsets.UTF_8.toString()) // decode date and + symbol in the location path
            val pattern = case.deliveryTargets?.find{ it.name == delivery.name}?.pathTemplate?.get(EnvConfig.ENVIRONMENT)
            val expectedLocation = pattern
                ?.replace("{dataStream}", case.manifest["data_stream_id"].toString())
                ?.replace("{route}", case.manifest["data_stream_route"].toString())
                ?.replace("{year}", currentDateTime.year.toString() )
                ?.replace("{month}", String.format("%02d", currentDateTime.monthValue) )
                ?.replace("{day}", String.format("%02d", currentDateTime.dayOfMonth) )
                ?.replace("{hour}", String.format("%02d", currentDateTime.hour) )
                ?.replace("{filename}", case.manifest["received_filename"].toString())
                ?.replace("{uploadId}",uid)
            Assert.assertTrue(actualLocation.endsWith(expectedLocation.toString()), "Actual location ($actualLocation) does not end with the expected path: $expectedLocation")
            Assert.assertEquals(delivery.issues, null)
        }
    }
}
